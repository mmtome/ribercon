import type { ErpClient } from './types';
import { MockErpClient } from './mock-client';
import { RpErpClient } from './rp-client';

export * from './types';

/**
 * Ponto ÚNICO de acesso ao ERP. O resto do sistema nunca sabe qual driver está ativo.
 * ERP_DRIVER=mock (padrão) | rp
 */
export function getErpClient(): ErpClient {
  if (process.env.ERP_DRIVER === 'rp') {
    const url = process.env.ERP_BASE_URL;
    const token = process.env.ERP_TOKEN;
    if (!url || !token) {
      throw new Error('ERP_DRIVER=rp exige ERP_BASE_URL e ERP_TOKEN no .env');
    }
    return new RpErpClient(url, token);
  }
  return new MockErpClient();
}
