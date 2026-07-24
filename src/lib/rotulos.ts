import type { TipoSinal } from './motor/sinais';

/**
 * O rótulo em TEXTO acompanha a cor em todo lugar. Nunca só cor.
 *
 * Dois motivos, e o segundo é o que costuma ser esquecido: daltonismo, e tela de
 * celular sob sol de rua — que é onde este app é usado. Sob luz forte a diferença
 * entre âmbar e vermelho some, e o rótulo é a única coisa que resta.
 */
export const ROTULO: Record<TipoSinal, string> = {
  equip_ocioso: 'Equipamento parado',
  atrasado: 'Atrasado',
  queda: 'Consumo caindo',
  recompra: 'Na janela',
  preventiva: 'Preventiva',
  cadencia: 'Cliente novo',
  recuperacao: 'Recuperação',
};

export interface Aparencia {
  /** cor do texto do rótulo e do traço do card */
  texto: string;
  /** fundo do selo, translúcido para funcionar sobre qualquer superfície */
  selo: string;
  /** cor sólida usada no traço vertical à esquerda do card */
  traco: string;
}

export const APARENCIA: Record<TipoSinal, Aparencia> = {
  equip_ocioso: { texto: 'text-critico', selo: 'bg-critico/15', traco: 'bg-critico' },
  atrasado:     { texto: 'text-atencao', selo: 'bg-atencao/15', traco: 'bg-atencao' },
  queda:        { texto: 'text-atencao', selo: 'bg-atencao/15', traco: 'bg-atencao' },
  recuperacao:  { texto: 'text-texto',   selo: 'bg-white/5',    traco: 'bg-fraco' },
  recompra:     { texto: 'text-rib-claro', selo: 'bg-rib-claro/12', traco: 'bg-rib-claro' },
  preventiva:   { texto: 'text-rib-medio', selo: 'bg-rib-medio/15', traco: 'bg-rib-medio' },
  cadencia:     { texto: 'text-texto',   selo: 'bg-white/5',    traco: 'bg-fraco' },
};

export type Desfecho =
  | 'comprou' | 'vai_comprar' | 'nao_atendeu'
  | 'adiou' | 'sem_necessidade' | 'perdeu_concorrente';

/**
 * Os seis botões do registro. A ordem é a frequência esperada, não a alfabética:
 * o polegar do vendedor tem que cair no botão mais provável sem procurar.
 */
export const DESFECHOS: { id: Desfecho; rotulo: string; tom: 'ok' | 'neutro' | 'ruim' }[] = [
  { id: 'comprou',            rotulo: 'Comprou',            tom: 'ok' },
  { id: 'vai_comprar',        rotulo: 'Vai comprar',        tom: 'ok' },
  { id: 'nao_atendeu',        rotulo: 'Não atendeu',        tom: 'neutro' },
  { id: 'adiou',              rotulo: 'Adiar',              tom: 'neutro' },
  { id: 'sem_necessidade',    rotulo: 'Sem necessidade',    tom: 'neutro' },
  { id: 'perdeu_concorrente', rotulo: 'Perdi p/ concorrente', tom: 'ruim' },
];

export const ROTULO_DESFECHO: Record<Desfecho, string> = Object.fromEntries(
  DESFECHOS.map((d) => [d.id, d.rotulo]),
) as Record<Desfecho, string>;
