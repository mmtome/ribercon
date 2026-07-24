import type { Cliente } from '../erp/types';
import type {
  Campanha, CreditoCliente, MetaVendedor, FrequenciaVisita, Roteiro,
  CanalAtendimento, SituacaoCredito,
} from '../integracoes/types';
import type { Sinal } from './sinais';

/**
 * Enriquecimento do sinal com as fontes externas do diagnóstico (ALVO e Rota Exata).
 *
 * O motor de `sinais.ts` responde "quem precisa ser contatado". Esta camada responde
 * "e vale a pena contatar hoje?" — que é outra pergunta, e é onde ALVO e Rota Exata
 * entram:
 *
 *  - **ALVO** sabe se o cliente PODE comprar (crédito) e se existe argumento pronto
 *    (campanha vigente). Sinal de recompra num cliente bloqueado é trabalho jogado
 *    fora: o vendedor liga, ouve "seu financeiro travou meu pedido" e queima a
 *    confiança na fila inteira.
 *  - **Rota Exata** sabe se o vendedor já vai passar na porta do cliente hoje. Se vai,
 *    o custo do contato é praticamente zero e o sinal tem que subir.
 *
 * Regra de projeto: **todo ajuste é explícito e rotulado**. O score não pode virar
 * uma caixa-preta — a especificação descarta machine learning justamente para manter
 * a explicabilidade, e seria incoerente reintroduzi-la por aqui. Cada fator aparece
 * no card em português: "na sua rota hoje", "crédito bloqueado", "campanha ativa".
 */

export interface Ajuste {
  fonte: 'ALVO' | 'Rota Exata';
  fator: number;
  /** texto que vai renderizado no card, do jeito que está */
  rotulo: string;
}

export interface SinalEnriquecido extends Sinal {
  /** score do motor, antes das fontes externas — mantido para auditoria */
  score_base: number;
  ajustes: Ajuste[];
  credito: {
    situacao: SituacaoCredito;
    titulos_vencidos: number;
    maior_atraso_dias: number;
    saldo_devedor: number;
    limite: number;
  } | null;
  campanha: Campanha | null;
  /** próxima visita presencial já programada, se houver */
  visita: { data: string; sequencia: number; janela: string } | null;
  canal: CanalAtendimento;
  /**
   * Quando o crédito está travado, a ação do card deixa de ser "vender" e passa a ser
   * "destravar". É outro roteiro de conversa, e o vendedor precisa saber disso ANTES
   * de discar.
   */
  acao: 'ofertar' | 'resolver_credito';
}

// --- fatores ---------------------------------------------------------------
// Os números estão aqui em cima, nomeados, porque são o que vai ser calibrado no
// piloto. Nunca escreva um destes fatores solto no meio do código.

/** crédito travado: o sinal não some da base, mas não pode disputar o topo da fila */
export const FATOR_CREDITO_BLOQUEADO = 0.3;
/** crédito em atenção: ainda vende, com aviso */
export const FATOR_CREDITO_ATENCAO = 0.85;
/** campanha vigente na família: o vendedor tem argumento pronto */
export const FATOR_CAMPANHA = 1.25;
/** o vendedor já vai passar na porta hoje — custo de contato ~zero */
export const FATOR_ROTA_HOJE = 1.4;
/** visita programada em até 2 dias */
export const FATOR_ROTA_PROXIMA = 1.15;
/** vendedor com meta de positivação em risco e cliente ainda sem compra no mês */
export const FATOR_POSITIVACAO = 1.2;

export interface FontesExternas {
  credito: CreditoCliente[];
  campanhas: Campanha[];
  metas: MetaVendedor[];
  frequencias: FrequenciaVisita[];
  roteiros: Roteiro[];
  /** clientes que já compraram no mês corrente — sai das notas do ERP */
  positivadosNoMes: Set<string>;
}

function campanhaVale(c: Campanha, familiaId: string | null, segmento: string): boolean {
  if (c.familia_id !== null && c.familia_id !== familiaId) return false;
  if (c.segmentos.length > 0 && !c.segmentos.includes(segmento)) return false;
  return true;
}

/**
 * Aplica o contexto externo a cada sinal e devolve a lista reordenável.
 *
 * Não filtra nada: um sinal com crédito bloqueado continua existindo, só desce. Quem
 * decide o corte é `montarFila`, e o gestor precisa conseguir ver no painel que
 * existem 7 clientes travados no financeiro — se a gente sumisse com eles aqui, esse
 * número nunca apareceria em lugar nenhum.
 */
export function aplicarContexto(
  sinais: Sinal[],
  clientes: Cliente[],
  fontes: FontesExternas,
  hoje = new Date(),
): SinalEnriquecido[] {
  const clientePorId = new Map(clientes.map((c) => [c.id, c]));
  const creditoPorCliente = new Map(fontes.credito.map((c) => [c.cliente_id, c]));
  const freqPorCliente = new Map(fontes.frequencias.map((f) => [f.cliente_id, f]));
  const metaPorVendedor = new Map(fontes.metas.map((m) => [m.vendedor_id, m]));

  const hojeIso = hoje.toISOString().slice(0, 10);
  const vigentes = fontes.campanhas.filter((c) => c.inicio <= hojeIso && hojeIso <= c.fim);

  // próxima visita programada de cada cliente, olhando os roteiros à frente
  const proximaVisita = new Map<string, { data: string; sequencia: number; janela: string }>();
  for (const r of [...fontes.roteiros].sort((a, b) => a.data.localeCompare(b.data))) {
    if (r.data < hojeIso) continue;
    for (const p of r.paradas) {
      if (proximaVisita.has(p.cliente_id)) continue;
      proximaVisita.set(p.cliente_id, {
        data: r.data,
        sequencia: p.sequencia,
        janela: `${p.janela_inicio}–${p.janela_fim}`,
      });
    }
  }

  return sinais.map((s) => {
    const cliente = clientePorId.get(s.cliente_id);
    const segmento = cliente?.segmento ?? '';
    const ajustes: Ajuste[] = [];

    // ---- ALVO: crédito -----------------------------------------------------
    const cred = creditoPorCliente.get(s.cliente_id) ?? null;
    let acao: SinalEnriquecido['acao'] = 'ofertar';
    if (cred?.situacao === 'bloqueado') {
      acao = 'resolver_credito';
      ajustes.push({
        fonte: 'ALVO',
        fator: FATOR_CREDITO_BLOQUEADO,
        rotulo: `Crédito bloqueado · ${cred.titulos_vencidos} título(s) vencido(s), ` +
          `${cred.maior_atraso_dias} dias`,
      });
    } else if (cred?.situacao === 'atencao') {
      ajustes.push({
        fonte: 'ALVO',
        fator: FATOR_CREDITO_ATENCAO,
        rotulo: `Crédito em atenção · ${cred.maior_atraso_dias} dias de atraso`,
      });
    }

    // ---- ALVO: campanha vigente -------------------------------------------
    const campanha = vigentes.find((c) => campanhaVale(c, s.familia_id, segmento)) ?? null;
    if (campanha) {
      ajustes.push({
        fonte: 'ALVO',
        fator: FATOR_CAMPANHA,
        rotulo: `${campanha.nome} · ${campanha.desconto_pct}%`,
      });
    }

    // ---- ALVO: meta de positivação em risco -------------------------------
    const meta = metaPorVendedor.get(s.vendedor_id);
    if (
      meta &&
      meta.realizado_positivacao < meta.meta_positivacao &&
      !fontes.positivadosNoMes.has(s.cliente_id)
    ) {
      ajustes.push({
        fonte: 'ALVO',
        fator: FATOR_POSITIVACAO,
        rotulo: `Conta a positivação do mês (${meta.realizado_positivacao}/${meta.meta_positivacao})`,
      });
    }

    // ---- Rota Exata: visita programada ------------------------------------
    const freq = freqPorCliente.get(s.cliente_id);
    const canal: CanalAtendimento = freq?.canal ?? 'telefone';
    const visita = proximaVisita.get(s.cliente_id) ?? null;
    if (visita) {
      const dias = Math.round(
        (new Date(`${visita.data}T00:00:00Z`).getTime() -
          new Date(`${hojeIso}T00:00:00Z`).getTime()) / 86_400_000,
      );
      if (dias === 0) {
        ajustes.push({
          fonte: 'Rota Exata',
          fator: FATOR_ROTA_HOJE,
          rotulo: `Na sua rota hoje · parada ${visita.sequencia} · ${visita.janela}`,
        });
      } else if (dias <= 2) {
        ajustes.push({
          fonte: 'Rota Exata',
          fator: FATOR_ROTA_PROXIMA,
          rotulo: dias === 1 ? 'Visita programada amanhã' : `Visita programada em ${dias} dias`,
        });
      }
    }

    const fator = ajustes.reduce((f, a) => f * a.fator, 1);
    return {
      ...s,
      score_base: s.score,
      score: Math.round(s.score * fator * 100) / 100,
      ajustes,
      credito: cred && {
        situacao: cred.situacao,
        titulos_vencidos: cred.titulos_vencidos,
        maior_atraso_dias: cred.maior_atraso_dias,
        saldo_devedor: cred.saldo_devedor,
        limite: cred.limite,
      },
      campanha,
      visita,
      canal,
      acao,
    };
  });
}
