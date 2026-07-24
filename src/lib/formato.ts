const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
});
const MOEDA_CENT = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
});

/** valor arredondado — usado no card e no cabeçalho, onde centavo é ruído */
export const reais = (v: number) => MOEDA.format(v);
/** valor com centavos — usado em financeiro, onde centavo importa */
export const reaisCent = (v: number) => MOEDA_CENT.format(v);

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "23/07" a partir de um ISO yyyy-mm-dd ou de um Date */
export function dataCurta(d: string | Date): string {
  const iso = typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  const [, m, dia] = iso.split('-');
  return `${dia}/${m}`;
}

/** "Quinta, 23/07" — cabeçalho da fila */
export function diaPorExtenso(d: Date): string {
  return `${DIAS[d.getUTCDay()]}, ${dataCurta(d)}`;
}

/** "jul/26" — usado onde há espaço */
export function mesCurto(yyyymm: string): string {
  const [ano, mes] = yyyymm.split('-');
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`;
}

/**
 * Rótulo do eixo do gráfico: só o mês, com o ano apenas em janeiro.
 *
 * "jul/25" não cabe numa coluna de 12 barras em tela de celular e trunca para
 * "jul/…", que é pior que não ter rótulo — o leitor gasta atenção decifrando em vez
 * de ler o gráfico. O ano em janeiro basta para ancorar a linha do tempo.
 */
export function mesEixo(yyyymm: string): string {
  const [ano, mes] = yyyymm.split('-');
  const nome = MESES[Number(mes) - 1];
  return mes === '01' ? `${nome}/${ano.slice(2)}` : nome;
}

/** "12 dias atrasado" / "em 3 dias" / "hoje" */
export function desvioEmTexto(dias: number): string {
  if (dias > 0) return `${dias} ${dias === 1 ? 'dia' : 'dias'} atrasado`;
  if (dias < 0) return `em ${-dias} ${dias === -1 ? 'dia' : 'dias'}`;
  return 'vence hoje';
}
