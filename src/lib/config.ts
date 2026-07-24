/**
 * Parâmetros de operação do motor.
 *
 * Ficam em variável de ambiente porque o sprint 6 prevê ajuste de LEAD_TIME na
 * implantação, com dado real do piloto — e ninguém vai querer fazer deploy para
 * trocar um número.
 */

function num(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto === '') return padrao;
  const v = Number(bruto);
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`${nome}="${bruto}" inválido: precisa ser um número positivo`);
  }
  return v;
}

/** dias de antecedência do alerta de recompra */
export const LEAD_TIME_DIAS = num('LEAD_TIME_DIAS', 5);

/**
 * Máximo de cards por vendedor por dia.
 *
 * NÃO aumente sem ler a seção 5.4 da especificação. A fila é curta de propósito:
 * fila de 60 clientes é lida como "impossível" e o vendedor para de abrir o app.
 * O motor gera muito mais sinal do que isso — é o score que decide o que sobe.
 */
export const TAMANHO_FILA = num('TAMANHO_FILA', 10);

/** driver ativo de cada fonte externa — só para exibir no rodapé do painel */
export const DRIVERS = {
  erp: process.env.ERP_DRIVER ?? 'mock',
  alvo: process.env.ALVO_DRIVER ?? 'mock',
  rota: process.env.ROTA_DRIVER ?? 'mock',
} as const;
