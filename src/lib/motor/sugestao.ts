import type { Nota, Produto } from '../erp/types';

/**
 * Pedido sugerido por (cliente, família).
 *
 * A especificação exige que o card chegue com o pedido já montado — é um dos quatro
 * pontos do princípio "entrega trabalho pronto antes de pedir dado". Um card que diz
 * "ligue para o Hospital São Vida" e para por aí devolve menos do que custa ler.
 *
 * Como é montado, e por que assim:
 *  - **SKU:** o mais comprado nas últimas 3 compras da família, não o último. Uma
 *    troca pontual de marca por falta de estoque não pode virar a sugestão fixa.
 *  - **Quantidade:** a mediana das últimas 3, não a média. Mesmo motivo do ciclo —
 *    uma compra de estoque de fim de ano estraga a média.
 *
 * O vendedor pode mudar tudo na hora do registro. A sugestão existe para ele ter
 * um ponto de partida, não para acertar sempre.
 */

export interface PedidoSugerido {
  produto_id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_estimado: number;
}

function medianaInt(nums: number[]): number {
  const ord = [...nums].sort((a, b) => a - b);
  const m = Math.floor(ord.length / 2);
  const v = ord.length % 2 ? ord[m] : (ord[m - 1] + ord[m]) / 2;
  return Math.max(1, Math.round(v));
}

/** chave do mapa: `${cliente_id}|${familia_id}` */
export function calcularSugestoes(
  notas: Nota[],
  produtos: Produto[],
): Map<string, PedidoSugerido> {
  const produtoPorId = new Map(produtos.map((p) => [p.id, p]));

  // (cliente|familia) -> compras ordenadas por data
  interface Linha { data: string; produto_id: string; quantidade: number }
  const porChave = new Map<string, Linha[]>();

  for (const n of notas) {
    for (const it of n.itens) {
      const chave = `${n.cliente_id}|${it.familia_id}`;
      if (!porChave.has(chave)) porChave.set(chave, []);
      porChave.get(chave)!.push({
        data: n.data_emissao,
        produto_id: it.produto_id,
        quantidade: it.quantidade,
      });
    }
  }

  const saida = new Map<string, PedidoSugerido>();
  for (const [chave, linhas] of porChave) {
    linhas.sort((a, b) => a.data.localeCompare(b.data));
    const ultimas = linhas.slice(-3);

    const frequencia = new Map<string, number>();
    for (const l of ultimas) {
      frequencia.set(l.produto_id, (frequencia.get(l.produto_id) ?? 0) + 1);
    }
    // empate resolve pelo mais recente: `ultimas` já está em ordem crescente de data,
    // então percorrer do fim para o começo faz o último ganhar
    let escolhido = ultimas[ultimas.length - 1].produto_id;
    let melhor = 0;
    for (let i = ultimas.length - 1; i >= 0; i--) {
      const f = frequencia.get(ultimas[i].produto_id)!;
      if (f > melhor) {
        melhor = f;
        escolhido = ultimas[i].produto_id;
      }
    }

    const produto = produtoPorId.get(escolhido);
    if (!produto) continue;

    const qtd = medianaInt(ultimas.map((l) => l.quantidade));
    saida.set(chave, {
      produto_id: produto.id,
      descricao: produto.descricao,
      quantidade: qtd,
      unidade: produto.unidade,
      valor_estimado: Math.round(qtd * produto.preco_tabela * 100) / 100,
    });
  }

  return saida;
}
