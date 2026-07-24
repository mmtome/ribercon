import type { AlvoClient, RotaClient } from './types';
import { MockAlvoClient } from './alvo/mock-client';
import { AlvoHttpClient } from './alvo/alvo-client';
import { MockRotaClient } from './rota-exata/mock-client';
import { RotaExataHttpClient } from './rota-exata/rota-exata-client';

export * from './types';

function exigir(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`${nome} é obrigatório quando o driver não é "mock"`);
  return v;
}

/**
 * Pontos ÚNICOS de acesso às fontes externas. O resto do sistema nunca sabe
 * qual driver está ativo.
 *
 * ALVO_DRIVER=mock (padrão) | http
 * ROTA_DRIVER=mock (padrão) | http
 *
 * Os drivers são independentes: dá para ligar o ALVO real e deixar o Rota Exata
 * no mock, que é exatamente como a virada acontece na prática — uma fonte por vez,
 * nunca as três no mesmo dia.
 */
export function getAlvoClient(): AlvoClient {
  if (process.env.ALVO_DRIVER === 'http') {
    return new AlvoHttpClient(exigir('ALVO_BASE_URL'), exigir('ALVO_TOKEN'));
  }
  return new MockAlvoClient();
}

export function getRotaClient(): RotaClient {
  if (process.env.ROTA_DRIVER === 'http') {
    return new RotaExataHttpClient(exigir('ROTA_BASE_URL'), exigir('ROTA_TOKEN'));
  }
  return new MockRotaClient();
}
