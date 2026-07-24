/**
 * Contratos das fontes externas que o diagnóstico lista ao lado do ERP:
 * ERP RP · **ALVO** · **Rota Exata**.
 *
 * Mesma disciplina da camada de ERP: aqui está só o CONTRATO. Mock e implementação
 * real assinam a mesma interface, e trocar um pelo outro é mexer no .env.
 * Nunca importe um client concreto — use getAlvoClient() / getRotaClient().
 *
 * Por que estas fontes existem no MVP se a integração real é Fase 2: porque elas
 * mudam o QUE sobe na fila, não só a decoração do card. Um sinal de recompra num
 * cliente com o crédito bloqueado é trabalho jogado fora, e um cliente que o vendedor
 * já vai visitar hoje custa zero para contatar. Modelar isso agora — mesmo simulado —
 * evita ter que reescrever o score depois.
 */

// ===========================================================================
// ALVO — gestão comercial (metas, campanhas, política, crédito)
// ===========================================================================

export interface MetaVendedor {
  vendedor_id: string;
  /** competência no formato yyyy-mm */
  competencia: string;
  meta_faturamento: number;
  realizado_faturamento: number;
  /** quantos clientes distintos precisam comprar no mês */
  meta_positivacao: number;
  realizado_positivacao: number;
}

export interface Campanha {
  id: string;
  nome: string;
  /** família em promoção; null = campanha geral */
  familia_id: string | null;
  /** só vale para estes segmentos; vazio = todos */
  segmentos: string[];
  inicio: string; // ISO yyyy-mm-dd
  fim: string;    // ISO yyyy-mm-dd
  desconto_pct: number;
  /** argumento pronto para o vendedor usar — vai renderizado no card */
  mecanica: string;
}

export type SituacaoCredito = 'liberado' | 'atencao' | 'bloqueado';

export interface CreditoCliente {
  cliente_id: string;
  situacao: SituacaoCredito;
  limite: number;
  saldo_devedor: number;
  titulos_vencidos: number;
  /** dias de atraso do título mais antigo em aberto; 0 = nada vencido */
  maior_atraso_dias: number;
}

export interface AlvoClient {
  listMetas(competencia?: string): Promise<MetaVendedor[]>;
  listCampanhas(vigentesEm?: Date): Promise<Campanha[]>;
  listCredito(): Promise<CreditoCliente[]>;
}

// ===========================================================================
// Rota Exata — roteirização e frequência de visita
// ===========================================================================

export type CanalAtendimento = 'presencial' | 'telefone';

export interface ParadaRoteiro {
  cliente_id: string;
  /** posição na sequência do dia; 1 = primeira parada */
  sequencia: number;
  janela_inicio: string; // HH:MM
  janela_fim: string;    // HH:MM
}

export interface Roteiro {
  vendedor_id: string;
  data: string; // ISO yyyy-mm-dd
  paradas: ParadaRoteiro[];
  km_previsto: number;
}

export interface FrequenciaVisita {
  cliente_id: string;
  /** 1 = segunda … 6 = sábado; vazio = cliente sem visita programada */
  dias_semana: number[];
  /** a cada quantas semanas o cliente é visitado */
  periodicidade_semanas: number;
  canal: CanalAtendimento;
  latitude: number;
  longitude: number;
}

export interface RotaClient {
  /** roteiros de um intervalo de datas, inclusivo nas duas pontas */
  listRoteiros(de: Date, ate: Date): Promise<Roteiro[]>;
  listFrequencias(): Promise<FrequenciaVisita[]>;
}
