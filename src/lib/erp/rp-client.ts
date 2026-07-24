import type {
  ErpClient, Cliente, Nota, Produto, Familia, Vendedor, Equipamento,
} from './types';

/**
 * Implementação real do ERP RP. AINDA NÃO IMPLEMENTADA.
 *
 * Este arquivo é, de propósito, o checklist da Fase 0 (descoberta técnica).
 * Cada método aqui é uma pergunta a fazer para o fornecedor do ERP ANTES
 * de precificar o projeto:
 *
 *  [ ] Autenticação: token fixo, OAuth, ou usuário/senha por requisição?
 *  [ ] Existe endpoint de notas fiscais COM os itens, ou só o cabeçalho?
 *      (sem itens não há cálculo por família — o motor inteiro depende disso)
 *  [ ] Dá para filtrar por data de emissão? Qual o formato aceito?
 *  [ ] Tem paginação? Qual o limite por página e o rate limit?
 *  [ ] O cadastro de cliente tem campo de SEGMENTO preenchido?
 *      (é o fallback do motor para cliente novo — se não tiver, vira escopo)
 *  [ ] O parque de comodato está no ERP ou em planilha à parte?
 *  [ ] Produto tem FAMÍLIA/grupo cadastrado e confiável?
 *  [ ] A API é só de leitura ou aceita escrita? (define se a Fase 3 existe)
 *  [ ] Ambiente de homologação disponível para testes?
 */
export class RpErpClient implements ErpClient {
  constructor(private baseUrl: string, private token: string) {}

  private naoImplementado(metodo: string): never {
    throw new Error(
      `RpErpClient.${metodo}() não implementado. ` +
      `Depende da Fase 0 — ver checklist em src/lib/erp/rp-client.ts`,
    );
  }

  listVendedores(): Promise<Vendedor[]>       { this.naoImplementado('listVendedores'); }
  listFamilias(): Promise<Familia[]>          { this.naoImplementado('listFamilias'); }
  listProdutos(): Promise<Produto[]>          { this.naoImplementado('listProdutos'); }
  listClientes(_desde?: Date): Promise<Cliente[]>  { this.naoImplementado('listClientes'); }
  listNotas(_desde?: Date): Promise<Nota[]>   { this.naoImplementado('listNotas'); }
  listEquipamentos(): Promise<Equipamento[]>  { this.naoImplementado('listEquipamentos'); }
}
