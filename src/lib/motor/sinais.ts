import type { Cliente, Equipamento } from '../erp/types';
import type { CicloClienteFamilia } from './ciclo';
import { MIN_COMPRAS_PROPRIO } from './ciclo';
import { LEAD_TIME_DIAS, TAMANHO_FILA } from '../config';

export { LEAD_TIME_DIAS, TAMANHO_FILA };

export type TipoSinal =
  | 'recompra'      // entrou na janela de reposição
  | 'atrasado'      // passou da janela
  | 'equip_ocioso'  // dispenser em comodato sem consumo — suspeita de concorrente
  | 'queda'         // intervalos crescendo, cliente esfriando
  | 'preventiva'    // manutenção preventiva vencendo
  | 'cadencia'      // cliente novo, sem ciclo calculável
  | 'recuperacao';  // sumiu há muito tempo

export interface Sinal {
  tipo: TipoSinal;
  cliente_id: string;
  familia_id: string | null;
  equipamento_id: string | null;
  vendedor_id: string;
  data_prevista: Date | null;
  dias_desvio: number;      // + atrasado, - antecipado
  valor_esperado: number;
  score: number;
  motivo: Record<string, unknown>;
}

/** um cliente parado além de mediana × isto vira recuperação, não urgência */
export const FATOR_PERDIDO = 3.0;

/** dispenser sem consumo além de mediana × isto = alerta crítico */
export const FATOR_OCIOSO = 2.5;

/**
 * Valor de REFERÊNCIA da manutenção preventiva, só para o sinal conseguir disputar
 * posição na mesma escala dos outros — o score é `valor × urgência × peso`, e sem um
 * valor a preventiva ficaria zerada e nunca apareceria.
 *
 * Note que `valor_esperado` do sinal continua 0, de propósito: a preventiva não gera
 * receita de produto, e somar isto no "R$ em jogo" do cabeçalho da fila seria inflar
 * o número na cara do vendedor. A assimetria é intencional.
 */
export const VALOR_REF_PREVENTIVA = 150;

export const PESO_TIPO: Record<TipoSinal, number> = {
  equip_ocioso: 3.0,
  atrasado: 1.6,
  queda: 1.5,
  recompra: 1.0,
  preventiva: 0.9,
  cadencia: 0.5,
  recuperacao: 0.4,
};

function diasDesde(d: Date, hoje: Date): number {
  return Math.round((hoje.getTime() - d.getTime()) / 86_400_000);
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function calcularScore(
  tipo: TipoSinal,
  valorEsperado: number,
  diasDesvio: number,
  medianaDias: number,
): number {
  const urgencia = clamp(diasDesvio / Math.max(medianaDias, 1), -0.5, 2.0) + 1;
  return Math.round(valorEsperado * urgencia * PESO_TIPO[tipo] * 100) / 100;
}

export function gerarSinais(
  clientes: Cliente[],
  ciclos: CicloClienteFamilia[],
  equipamentos: Equipamento[],
  hoje = new Date(),
): Sinal[] {
  const clientePorId = new Map(clientes.map((c) => [c.id, c]));
  const sinais: Sinal[] = [];
  const cicloPorChave = new Map(ciclos.map((c) => [`${c.cliente_id}|${c.familia_id}`, c]));

  // ---- 1. ciclo de recompra, atraso, queda e recuperação ----
  for (const c of ciclos) {
    const cliente = clientePorId.get(c.cliente_id);
    if (!cliente || !cliente.ativo) continue;

    const dias = diasDesde(c.ultima_compra, hoje);
    const prevista = addDias(c.ultima_compra, Math.round(c.mediana_dias));
    const desvio = dias - Math.round(c.mediana_dias);

    let tipo: TipoSinal | null = null;

    if (c.n_compras < MIN_COMPRAS_PROPRIO) {
      // cliente novo: cadência fixa, sem fingir que existe ciclo
      if (dias >= 30) tipo = 'cadencia';
    } else if (dias > c.mediana_dias * FATOR_PERDIDO) {
      tipo = 'recuperacao';
    } else if (dias > c.mediana_dias * 1.15) {
      tipo = 'atrasado';
    } else if (dias >= c.mediana_dias - LEAD_TIME_DIAS) {
      tipo = 'recompra';
    }

    if (tipo) {
      sinais.push({
        tipo,
        cliente_id: c.cliente_id,
        familia_id: c.familia_id,
        equipamento_id: null,
        vendedor_id: cliente.vendedor_id,
        data_prevista: prevista,
        dias_desvio: desvio,
        valor_esperado: c.ticket_medio,
        score: calcularScore(tipo, c.ticket_medio, desvio, c.mediana_dias),
        motivo: {
          familia_id: c.familia_id,
          ciclo_dias: c.mediana_dias,
          origem_ciclo: c.origem,
          ultima_compra: c.ultima_compra.toISOString().slice(0, 10),
          dias_sem_comprar: dias,
          n_compras: c.n_compras,
        },
      });
    }

    // cliente esfriando: últimos 3 intervalos bem acima da mediana histórica
    if (c.media_recente && c.n_compras >= 6 && c.media_recente > c.mediana_dias * 1.5) {
      sinais.push({
        tipo: 'queda',
        cliente_id: c.cliente_id,
        familia_id: c.familia_id,
        equipamento_id: null,
        vendedor_id: cliente.vendedor_id,
        data_prevista: prevista,
        dias_desvio: Math.round(c.media_recente - c.mediana_dias),
        valor_esperado: c.ticket_medio,
        score: calcularScore('queda', c.ticket_medio, c.media_recente - c.mediana_dias, c.mediana_dias),
        motivo: {
          familia_id: c.familia_id,
          ciclo_historico: c.mediana_dias,
          ciclo_recente: Math.round(c.media_recente),
          n_compras: c.n_compras,
        },
      });
    }
  }

  // ---- 2. equipamento ocioso — o sinal que vale mais no modelo de comodato ----
  // Dispenser instalado e refil parado significa uma de duas coisas: a conta morreu,
  // ou um concorrente está abastecendo o equipamento que é da distribuidora.
  // Nos dois casos é receita vazando em silêncio e quebra de exclusividade.
  for (const eq of equipamentos) {
    if (eq.status !== 'ativo') continue;
    const cliente = clientePorId.get(eq.cliente_id);
    if (!cliente || !cliente.ativo) continue;

    const c = cicloPorChave.get(`${eq.cliente_id}|${eq.familia_consumivel_id}`);
    if (!c) continue;

    const dias = diasDesde(c.ultima_compra, hoje);
    if (dias > c.mediana_dias * FATOR_OCIOSO) {
      sinais.push({
        tipo: 'equip_ocioso',
        cliente_id: eq.cliente_id,
        familia_id: eq.familia_consumivel_id,
        equipamento_id: eq.id,
        vendedor_id: cliente.vendedor_id,
        data_prevista: null,
        dias_desvio: dias - Math.round(c.mediana_dias),
        valor_esperado: c.ticket_medio,
        score: calcularScore('equip_ocioso', c.ticket_medio, dias - c.mediana_dias, c.mediana_dias),
        motivo: {
          equipamento: eq.tipo,
          numero_serie: eq.numero_serie,
          quantidade: eq.quantidade,
          dias_sem_consumo: dias,
          ciclo_esperado: c.mediana_dias,
        },
      });
    }
  }

  // ---- 3. manutenção preventiva vencendo ----
  for (const eq of equipamentos) {
    if (eq.status !== 'ativo') continue;
    const cliente = clientePorId.get(eq.cliente_id);
    if (!cliente || !cliente.ativo) continue;

    const vence = addDias(new Date(eq.ultima_manutencao), eq.intervalo_preventivo_dias);
    const faltam = Math.round((vence.getTime() - hoje.getTime()) / 86_400_000);
    if (faltam <= 15) {
      sinais.push({
        tipo: 'preventiva',
        cliente_id: eq.cliente_id,
        familia_id: null,
        equipamento_id: eq.id,
        vendedor_id: cliente.vendedor_id,
        data_prevista: vence,
        dias_desvio: -faltam,
        valor_esperado: 0,
        score: calcularScore(
          'preventiva', VALOR_REF_PREVENTIVA, -faltam, eq.intervalo_preventivo_dias,
        ),
        motivo: {
          equipamento: eq.tipo,
          numero_serie: eq.numero_serie,
          vence_em_dias: faltam,
          ultima_manutencao: eq.ultima_manutencao,
        },
      });
    }
  }

  return sinais;
}

/**
 * Genérico em T para aceitar tanto o `Sinal` cru quanto o `SinalEnriquecido` de
 * `contexto.ts`, sem a fila precisar saber que ALVO e Rota Exata existem.
 */
export interface CardFila<T extends Sinal = Sinal> {
  cliente_id: string;
  principal: T;
  /** demais sinais do mesmo cliente, exibidos como linhas secundárias do card */
  secundarios: T[];
  score_total: number;
}

/**
 * Monta a fila do dia de um vendedor.
 *
 * Regras que parecem detalhe de UI mas decidem a adesão:
 *  - um cliente aparece UMA vez (ninguém liga duas vezes pro mesmo lugar);
 *  - a fila é cortada em TAMANHO_FILA e tem fim visível.
 * Fila de 60 clientes é lida como "impossível" e ninguém começa.
 */
export function montarFila<T extends Sinal>(
  sinais: T[],
  vendedorId: string,
  limite = TAMANHO_FILA,
): CardFila<T>[] {
  const doVendedor = sinais.filter((s) => s.vendedor_id === vendedorId);

  const porCliente = new Map<string, T[]>();
  for (const s of doVendedor) {
    if (!porCliente.has(s.cliente_id)) porCliente.set(s.cliente_id, []);
    porCliente.get(s.cliente_id)!.push(s);
  }

  const cards: CardFila<T>[] = [];
  for (const [cliente_id, lista] of porCliente) {
    lista.sort((a, b) => b.score - a.score);
    cards.push({
      cliente_id,
      principal: lista[0],
      secundarios: lista.slice(1),
      score_total: lista.reduce((s, x) => s + x.score, 0),
    });
  }

  cards.sort((a, b) => b.principal.score - a.principal.score);
  return cards.slice(0, limite);
}
