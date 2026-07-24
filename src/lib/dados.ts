import { cache } from 'react';
import { getErpClient } from './erp';
import type { Cliente, Nota, Equipamento, Familia, Produto, Vendedor } from './erp/types';
import { getAlvoClient, getRotaClient } from './integracoes';
import { calcularCiclos, type CicloClienteFamilia } from './motor/ciclo';
import { gerarSinais, montarFila, type CardFila } from './motor/sinais';
import { aplicarContexto, type SinalEnriquecido, type FontesExternas } from './motor/contexto';
import { calcularSugestoes, type PedidoSugerido } from './motor/sugestao';

/**
 * Camada de dados do app.
 *
 * ATENÇÃO — estado provisório, e de propósito: hoje isto lê as fontes e roda o motor
 * a cada requisição, em memória. O desenho final da especificação é outro: o job de
 * sync popula o Postgres de madrugada, o motor grava a tabela `sinal` às 05:30, e a
 * tela só faz `select`.
 *
 * A troca é local a este arquivo. As telas consomem `filaDoDia()` e `dadosDoCliente()`
 * e não sabem de onde veio — quando o job existir, o corpo destas funções vira query
 * e nada acima muda. É o mesmo motivo de `getErpClient()` existir.
 *
 * O que NÃO fazer aqui: chamar `getErpClient()` direto de dentro de um componente.
 * Isso espalharia leitura de arquivo pela árvore de render e transformaria a migração
 * para banco numa refatoração de tela.
 */

export const HOJE = new Date('2026-07-23T00:00:00Z');

export interface BaseCarregada {
  clientes: Cliente[];
  notas: Nota[];
  equipamentos: Equipamento[];
  familias: Familia[];
  produtos: Produto[];
  vendedores: Vendedor[];
  ciclos: CicloClienteFamilia[];
  sinais: SinalEnriquecido[];
  fontes: FontesExternas;
  /** chave `${cliente_id}|${familia_id}` */
  sugestoes: Map<string, PedidoSugerido>;
}

/**
 * `cache` do React deduplica a chamada dentro da MESMA requisição. Não é cache entre
 * requisições — em dev, cada F5 recarrega e recalcula, que é o comportamento que se
 * quer enquanto as regras estão sendo mexidas.
 */
export const carregarBase = cache(async (): Promise<BaseCarregada> => {
  const erp = getErpClient();
  const alvo = getAlvoClient();
  const rota = getRotaClient();

  const [clientes, notas, equipamentos, familias, produtos, vendedores] = await Promise.all([
    erp.listClientes(),
    erp.listNotas(),
    erp.listEquipamentos(),
    erp.listFamilias(),
    erp.listProdutos(),
    erp.listVendedores(),
  ]);

  const [credito, campanhas, metas, frequencias, roteiros] = await Promise.all([
    alvo.listCredito(),
    alvo.listCampanhas(),
    alvo.listMetas(HOJE.toISOString().slice(0, 7)),
    rota.listFrequencias(),
    // 14 dias à frente: o motor só usa os 3 primeiros, mas a tela do cliente mostra
    // a próxima visita mesmo quando ela é longe
    rota.listRoteiros(HOJE, new Date(HOJE.getTime() + 14 * 86_400_000)),
  ]);

  // positivação do mês sai das notas do ERP, não do ALVO: se o ALVO mandasse o número
  // pronto e ele divergisse do faturamento, o gestor perderia a confiança na tela
  const competencia = HOJE.toISOString().slice(0, 7);
  const positivadosNoMes = new Set(
    notas.filter((n) => n.data_emissao.startsWith(competencia)).map((n) => n.cliente_id),
  );

  const fontes: FontesExternas = {
    credito, campanhas, metas, frequencias, roteiros, positivadosNoMes,
  };

  const ciclos = calcularCiclos(clientes, notas);
  const crus = gerarSinais(clientes, ciclos, equipamentos, HOJE);
  const sinais = aplicarContexto(crus, clientes, fontes, HOJE);

  return {
    clientes, notas, equipamentos, familias, produtos, vendedores,
    ciclos, sinais, fontes,
    sugestoes: calcularSugestoes(notas, produtos),
  };
});

/**
 * Modelo de exibição do card — plano e serializável de propósito.
 *
 * O componente da fila é client component (precisa de estado para o bottom sheet), e
 * tudo que cruza a fronteira servidor→cliente vira payload. Mandar o objeto de domínio
 * inteiro faria trafegar histórico de nota que a tela nunca usa. Este tipo é o
 * contrato do que o card realmente desenha — nada além.
 */
export interface CardView {
  cliente_id: string;
  nome: string;
  segmento: string;
  cidade: string;
  uf: string;
  tipo: SinalEnriquecido['tipo'];
  familia: string | null;
  valor_esperado: number;
  score: number;
  score_base: number;
  dias_desvio: number;
  ciclo_dias: number | null;
  origem_ciclo: 'proprio' | 'segmento' | null;
  ultima_compra: string | null;
  dias_sem_comprar: number | null;
  /** só nos sinais de equipamento: tipo do dispenser e número de série */
  equipamento: { tipo: string; numero_serie: string } | null;
  sugestao: PedidoSugerido | null;
  ajustes: SinalEnriquecido['ajustes'];
  credito: SinalEnriquecido['credito'];
  campanha: { nome: string; desconto_pct: number; mecanica: string } | null;
  visita: SinalEnriquecido['visita'];
  canal: SinalEnriquecido['canal'];
  acao: SinalEnriquecido['acao'];
  /** linhas secundárias: os demais sinais do mesmo cliente */
  secundarios: { tipo: SinalEnriquecido['tipo']; familia: string | null }[];
}

export interface FilaDoDia {
  vendedor: Vendedor;
  cards: CardView[];
  /** soma do valor esperado dos sinais principais — o "R$ em jogo" do cabeçalho */
  valorEmJogo: number;
  criticos: number;
  /** quantos clientes o vendedor tem em aberto além do corte da fila */
  naFilaDeEspera: number;
}

function paraView(
  card: CardFila<SinalEnriquecido>,
  base: BaseCarregada,
): CardView {
  const s = card.principal;
  const cliente = base.clientes.find((c) => c.id === s.cliente_id)!;
  const familia = s.familia_id ? base.familias.find((f) => f.id === s.familia_id) : undefined;
  const motivo = s.motivo as Record<string, unknown>;

  // Cada tipo de sinal grava o `motivo` com as chaves que fazem sentido para ele:
  // recompra fala em `ciclo_dias`, equipamento ocioso fala em `ciclo_esperado` e
  // `dias_sem_consumo`, queda fala em `ciclo_historico`. A tela não deveria conhecer
  // esse vocabulário todo — a normalização mora aqui.
  const num = (...chaves: string[]): number | null => {
    for (const k of chaves) if (typeof motivo[k] === 'number') return motivo[k] as number;
    return null;
  };

  return {
    cliente_id: s.cliente_id,
    nome: cliente.nome_fantasia,
    segmento: cliente.segmento,
    cidade: cliente.cidade,
    uf: cliente.uf,
    tipo: s.tipo,
    familia: familia?.nome ?? null,
    valor_esperado: s.valor_esperado,
    score: s.score,
    score_base: s.score_base,
    dias_desvio: s.dias_desvio,
    ciclo_dias: num('ciclo_dias', 'ciclo_esperado', 'ciclo_historico'),
    origem_ciclo: motivo.origem_ciclo === 'proprio' || motivo.origem_ciclo === 'segmento'
      ? motivo.origem_ciclo
      : null,
    ultima_compra: typeof motivo.ultima_compra === 'string' ? motivo.ultima_compra : null,
    dias_sem_comprar: num('dias_sem_comprar', 'dias_sem_consumo'),
    equipamento: typeof motivo.equipamento === 'string'
      ? {
          tipo: (motivo.equipamento as string).replace(/_/g, ' '),
          numero_serie: String(motivo.numero_serie ?? ''),
        }
      : null,
    sugestao: s.familia_id
      ? base.sugestoes.get(`${s.cliente_id}|${s.familia_id}`) ?? null
      : null,
    ajustes: s.ajustes,
    credito: s.credito,
    campanha: s.campanha && {
      nome: s.campanha.nome,
      desconto_pct: s.campanha.desconto_pct,
      mecanica: s.campanha.mecanica,
    },
    visita: s.visita,
    canal: s.canal,
    acao: s.acao,
    secundarios: card.secundarios.map((x) => ({
      tipo: x.tipo,
      familia: x.familia_id
        ? base.familias.find((f) => f.id === x.familia_id)?.nome ?? null
        : null,
    })),
  };
}

export async function filaDoDia(vendedorId: string): Promise<FilaDoDia | null> {
  const base = await carregarBase();
  const vendedor = base.vendedores.find((v) => v.id === vendedorId);
  if (!vendedor) return null;

  const cards = montarFila(base.sinais, vendedorId).map((c) => paraView(c, base));
  const todosOsClientes = new Set(
    base.sinais.filter((s) => s.vendedor_id === vendedorId).map((s) => s.cliente_id),
  );

  return {
    vendedor,
    cards,
    valorEmJogo: cards.reduce((s, c) => s + c.valor_esperado, 0),
    criticos: cards.filter((c) => c.tipo === 'equip_ocioso').length,
    naFilaDeEspera: Math.max(0, todosOsClientes.size - cards.length),
  };
}

export interface CompraPorMes {
  mes: string; // yyyy-mm
  valor: number;
}

export interface DadosCliente {
  cliente: Cliente;
  vendedor: Vendedor | undefined;
  ciclos: CicloClienteFamilia[];
  equipamentos: Equipamento[];
  sinais: SinalEnriquecido[];
  historico: CompraPorMes[];
  credito: FontesExternas['credito'][number] | undefined;
  frequencia: FontesExternas['frequencias'][number] | undefined;
  proximaVisita: { data: string; sequencia: number } | undefined;
  familias: Map<string, Familia>;
}

export async function dadosDoCliente(clienteId: string): Promise<DadosCliente | null> {
  const base = await carregarBase();
  const cliente = base.clientes.find((c) => c.id === clienteId);
  if (!cliente) return null;

  const porMes = new Map<string, number>();
  for (const n of base.notas) {
    if (n.cliente_id !== clienteId) continue;
    const mes = n.data_emissao.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + n.valor_total);
  }

  const hojeIso = HOJE.toISOString().slice(0, 10);
  const visita = base.fontes.roteiros
    .filter((r) => r.data >= hojeIso && r.paradas.some((p) => p.cliente_id === clienteId))
    .sort((a, b) => a.data.localeCompare(b.data))[0];

  return {
    cliente,
    vendedor: base.vendedores.find((v) => v.id === cliente.vendedor_id),
    ciclos: base.ciclos.filter((c) => c.cliente_id === clienteId),
    equipamentos: base.equipamentos.filter((e) => e.cliente_id === clienteId),
    sinais: base.sinais.filter((s) => s.cliente_id === clienteId),
    historico: [...porMes.entries()]
      .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-12),
    credito: base.fontes.credito.find((c) => c.cliente_id === clienteId),
    frequencia: base.fontes.frequencias.find((f) => f.cliente_id === clienteId),
    proximaVisita: visita && {
      data: visita.data,
      sequencia: visita.paradas.find((p) => p.cliente_id === clienteId)!.sequencia,
    },
    familias: new Map(base.familias.map((f) => [f.id, f])),
  };
}
