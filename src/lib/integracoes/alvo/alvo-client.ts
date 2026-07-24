import type { AlvoClient, MetaVendedor, Campanha, CreditoCliente } from '../types';

/**
 * Implementação real do ALVO. AINDA NÃO IMPLEMENTADA — de propósito.
 *
 * Como o rp-client.ts, este arquivo é o checklist da Fase 0. Cada método é uma
 * pergunta a fazer ANTES de precificar a integração:
 *
 *  [ ] Autenticação: token fixo, OAuth, ou usuário/senha por requisição?
 *  [ ] A situação de crédito vem do ALVO ou direto do financeiro do ERP?
 *      (se vier dos dois, qual ganha? Definir agora evita card contraditório)
 *  [ ] O bloqueio de crédito é um flag ou tem que ser derivado de limite × saldo?
 *  [ ] Campanha tem vigência com hora ou só data? Vale por família ou por SKU?
 *      (o motor trabalha por FAMÍLIA — se o ALVO só der SKU, precisa de um de-para)
 *  [ ] Meta é por vendedor, por equipe, ou por filial?
 *  [ ] Positivação conta cliente distinto no mês ou pedido faturado?
 *  [ ] Existe webhook de mudança de crédito, ou só polling?
 *      (crédito desatualizado põe o vendedor na porta de quem não pode comprar)
 *  [ ] Ambiente de homologação disponível?
 */
export class AlvoHttpClient implements AlvoClient {
  constructor(private baseUrl: string, private token: string) {}

  private naoImplementado(metodo: string): never {
    throw new Error(
      `AlvoHttpClient.${metodo}() não implementado. ` +
      `Depende da Fase 0 — ver checklist em src/lib/integracoes/alvo/alvo-client.ts`,
    );
  }

  listMetas(_competencia?: string): Promise<MetaVendedor[]> { this.naoImplementado('listMetas'); }
  listCampanhas(_vigentesEm?: Date): Promise<Campanha[]>   { this.naoImplementado('listCampanhas'); }
  listCredito(): Promise<CreditoCliente[]>                 { this.naoImplementado('listCredito'); }
}
