import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RotaClient, Roteiro, FrequenciaVisita } from '../types';

/** Lê os JSONs gerados por scripts/gerar_mock_integracoes.py. */
export class MockRotaClient implements RotaClient {
  private cache = new Map<string, unknown>();

  constructor(private dir = join(process.cwd(), 'mock_integracoes')) {}

  private async ler<T>(arquivo: string): Promise<T> {
    if (!this.cache.has(arquivo)) {
      const bruto = await readFile(join(this.dir, arquivo), 'utf-8');
      this.cache.set(arquivo, JSON.parse(bruto));
    }
    return this.cache.get(arquivo) as T;
  }

  async listRoteiros(de: Date, ate: Date): Promise<Roteiro[]> {
    const todos = await this.ler<Roteiro[]>('rota_roteiros.json');
    const d = de.toISOString().slice(0, 10);
    const a = ate.toISOString().slice(0, 10);
    return todos.filter((r) => r.data >= d && r.data <= a);
  }

  listFrequencias(): Promise<FrequenciaVisita[]> {
    return this.ler<FrequenciaVisita[]>('rota_frequencias.json');
  }
}
