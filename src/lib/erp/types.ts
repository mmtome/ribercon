/**
 * Contrato da camada de ERP.
 *
 * O mock e a implementação real do ERP RP implementam esta MESMA interface.
 * Trocar um pelo outro é mudar a variável ERP_DRIVER no .env — nada mais.
 * Nunca importe MockErpClient ou RpErpClient direto: use getErpClient().
 */

export interface Vendedor {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface Familia {
  id: string;
  nome: string;
  /** tipo de dispenser que consome esta família; null = não é consumível de comodato */
  consumivel_de: string | null;
}

export interface Produto {
  id: string;
  descricao: string;
  familia_id: string;
  preco_tabela: number;
  unidade: string;
}

export interface Cliente {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  segmento: string;
  cidade: string;
  uf: string;
  vendedor_id: string;
  data_cadastro: string; // ISO yyyy-mm-dd
  ativo: boolean;
}

export interface NotaItem {
  produto_id: string;
  familia_id: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export interface Nota {
  id: string;
  numero: string;
  cliente_id: string;
  data_emissao: string; // ISO yyyy-mm-dd
  valor_total: number;
  itens: NotaItem[];
}

export type StatusEquipamento = 'ativo' | 'retirado' | 'manutencao';

export interface Equipamento {
  id: string;
  cliente_id: string;
  tipo: string;
  familia_consumivel_id: string;
  numero_serie: string;
  quantidade: number;
  data_instalacao: string;
  ultima_manutencao: string;
  intervalo_preventivo_dias: number;
  status: StatusEquipamento;
}

export interface ErpClient {
  listVendedores(): Promise<Vendedor[]>;
  listFamilias(): Promise<Familia[]>;
  listProdutos(): Promise<Produto[]>;
  listClientes(desde?: Date): Promise<Cliente[]>;
  /** @param desde sincronismo incremental — só notas emitidas a partir desta data */
  listNotas(desde?: Date): Promise<Nota[]>;
  listEquipamentos(): Promise<Equipamento[]>;
}
