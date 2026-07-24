import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AlvoClient, MetaVendedor, Campanha, CreditoCliente,
} from '../types';

/**
 * Lê os JSONs gerados por scripts/gerar_mock_integracoes.py.
 * Filtra igual ao sistema real filtraria — inclusive a vigência de campanha, que é
 * o filtro que mais dá problema em integração de verdade.
 */
export class MockAlvoClient implements AlvoClient {
  private cache = new Map<string, unknown>();

  constructor(private dir = join(process.cwd(), 'mock_integracoes')) {}

  private async ler<T>(arquivo: string): Promise<T> {
    if (!this.cache.has(arquivo)) {
      const bruto = await readFile(join(this.dir, arquivo), 'utf-8');
      this.cache.set(arquivo, JSON.parse(bruto));
    }
    return this.cache.get(arquivo) as T;
  }

  async listMetas(competencia?: string): Promise<MetaVendedor[]> {
    const todas = await this.ler<MetaVendedor[]>('alvo_metas.json');
    return competencia ? todas.filter((m) => m.competencia === competencia) : todas;
  }

  async listCampanhas(vigentesEm?: Date): Promise<Campanha[]> {
    const todas = await this.ler<Campanha[]>('alvo_campanhas.json');
    if (!vigentesEm) return todas;
    const dia = vigentesEm.toISOString().slice(0, 10);
    return todas.filter((c) => c.inicio <= dia && dia <= c.fim);
  }

  listCredito(): Promise<CreditoCliente[]> {
    return this.ler<CreditoCliente[]>('alvo_credito.json');
  }
}
