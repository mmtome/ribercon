import type { Cliente, Nota } from '../erp/types';

export interface CicloClienteFamilia {
  cliente_id: string;
  familia_id: string;
  n_compras: number;
  mediana_dias: number;
  desvio_dias: number;
  /** 'proprio' = calculado com o histórico do cliente; 'segmento' = estimado */
  origem: 'proprio' | 'segmento';
  ultima_compra: Date;
  ticket_medio: number;
  /** média dos 3 últimos intervalos — usada para detectar cliente esfriando */
  media_recente: number | null;
}

export const MIN_COMPRAS_PROPRIO = 3;

export function mediana(nums: number[]): number {
  if (nums.length === 0) return 0;
  const ord = [...nums].sort((a, b) => a - b);
  const m = Math.floor(ord.length / 2);
  return ord.length % 2 ? ord[m] : (ord[m - 1] + ord[m]) / 2;
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

interface Compra {
  data: Date;
  valor: number;
}

/**
 * Calcula o ciclo de recompra para cada par (cliente, família).
 *
 * Por que mediana e não média: uma compra atípica — feriado, promoção, estoque de
 * fim de ano — destrói a média e não mexe na mediana. Em histórico de distribuidora
 * isso acontece o tempo todo.
 *
 * Por que por FAMÍLIA e não por cliente: papel higiênico e sabonete têm ciclos de
 * consumo diferentes no mesmo cliente. Calcular por cliente mistura os dois e o
 * alerta sai sempre na hora errada.
 */
export function calcularCiclos(
  clientes: Cliente[],
  notas: Nota[],
): CicloClienteFamilia[] {
  const segmentoDe = new Map(clientes.map((c) => [c.id, c.segmento]));

  // (cliente|familia) -> compras
  const compras = new Map<string, Compra[]>();
  for (const nota of notas) {
    const data = new Date(nota.data_emissao);
    for (const item of nota.itens) {
      const chave = `${nota.cliente_id}|${item.familia_id}`;
      if (!compras.has(chave)) compras.set(chave, []);
      compras.get(chave)!.push({ data, valor: item.valor_total });
    }
  }

  // primeira passada: quem tem histórico próprio suficiente
  interface Parcial {
    cliente_id: string; familia_id: string;
    intervalos: number[]; ultima: Date; ticket: number; n: number;
  }
  const parciais: Parcial[] = [];

  for (const [chave, lista] of compras) {
    const [cliente_id, familia_id] = chave.split('|');
    lista.sort((a, b) => a.data.getTime() - b.data.getTime());
    const intervalos: number[] = [];
    for (let i = 1; i < lista.length; i++) {
      const d = diasEntre(lista[i - 1].data, lista[i].data);
      if (d > 0) intervalos.push(d);
    }
    parciais.push({
      cliente_id, familia_id, intervalos,
      ultima: lista[lista.length - 1].data,
      ticket: lista.reduce((s, c) => s + c.valor, 0) / lista.length,
      n: lista.length,
    });
  }

  // fallback: mediana por (segmento, família), montada só com quem tem base sólida
  const porSegmento = new Map<string, number[]>();
  for (const p of parciais) {
    if (p.n < MIN_COMPRAS_PROPRIO) continue;
    const seg = segmentoDe.get(p.cliente_id);
    if (!seg) continue;
    const k = `${seg}|${p.familia_id}`;
    if (!porSegmento.has(k)) porSegmento.set(k, []);
    porSegmento.get(k)!.push(mediana(p.intervalos));
  }
  const medianaSegmento = new Map<string, number>();
  for (const [k, v] of porSegmento) medianaSegmento.set(k, mediana(v));

  // segunda passada: monta o resultado
  const resultado: CicloClienteFamilia[] = [];
  for (const p of parciais) {
    const seg = segmentoDe.get(p.cliente_id);
    const proprio = p.n >= MIN_COMPRAS_PROPRIO && p.intervalos.length > 0;
    const medSeg = seg ? medianaSegmento.get(`${seg}|${p.familia_id}`) : undefined;

    const med = proprio ? mediana(p.intervalos) : medSeg;
    if (!med || med <= 0) continue; // sem base nenhuma: não inventa ciclo

    const media = p.intervalos.length
      ? p.intervalos.reduce((s, x) => s + x, 0) / p.intervalos.length
      : med;
    const desvio = p.intervalos.length
      ? Math.sqrt(p.intervalos.reduce((s, x) => s + (x - media) ** 2, 0) / p.intervalos.length)
      : 0;

    const ultimos3 = p.intervalos.slice(-3);
    resultado.push({
      cliente_id: p.cliente_id,
      familia_id: p.familia_id,
      n_compras: p.n,
      mediana_dias: Math.round(med * 100) / 100,
      desvio_dias: Math.round(desvio * 100) / 100,
      origem: proprio ? 'proprio' : 'segmento',
      ultima_compra: p.ultima,
      ticket_medio: Math.round(p.ticket * 100) / 100,
      media_recente: ultimos3.length === 3
        ? ultimos3.reduce((s, x) => s + x, 0) / 3
        : null,
    });
  }

  return resultado;
}
