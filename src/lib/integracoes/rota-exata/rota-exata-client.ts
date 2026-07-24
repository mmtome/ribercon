import type { RotaClient, Roteiro, FrequenciaVisita } from '../types';

/**
 * Implementação real do Rota Exata. AINDA NÃO IMPLEMENTADA — de propósito.
 *
 * Checklist da Fase 0:
 *
 *  [ ] Autenticação: token fixo, OAuth, ou usuário/senha por requisição?
 *  [ ] O roteiro do dia é publicado com quanta antecedência?
 *      (o motor roda 05:30 — se o roteiro só fecha às 08:00, o boost de rota
 *       entra atrasado e o card do dia sai errado)
 *  [ ] O ID do cliente no Rota Exata é o MESMO do ERP, ou precisa de de-para?
 *      Esta é a pergunta que mais atrasa integração de roteirizador.
 *  [ ] Roteiro é por vendedor ou por veículo/entregador?
 *      (se for logística de entrega, não serve para priorizar visita comercial)
 *  [ ] Existe replanejamento no meio do dia? Como o sistema é avisado?
 *  [ ] A frequência de visita é cadastro fixo ou saída de otimização?
 *  [ ] Tem geolocalização do cliente? Qual a qualidade do geocode?
 *  [ ] Ambiente de homologação disponível?
 */
export class RotaExataHttpClient implements RotaClient {
  constructor(private baseUrl: string, private token: string) {}

  private naoImplementado(metodo: string): never {
    throw new Error(
      `RotaExataHttpClient.${metodo}() não implementado. ` +
      `Depende da Fase 0 — ver checklist em src/lib/integracoes/rota-exata/rota-exata-client.ts`,
    );
  }

  listRoteiros(_de: Date, _ate: Date): Promise<Roteiro[]> { this.naoImplementado('listRoteiros'); }
  listFrequencias(): Promise<FrequenciaVisita[]>          { this.naoImplementado('listFrequencias'); }
}
