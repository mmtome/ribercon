import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ErpClient, Cliente, Nota, Produto, Familia, Vendedor, Equipamento,
} from './types';

/**
 * Lê os JSONs gerados por scripts/gerar_mock_erp.py.
 * Comporta-se como o ERP real: filtro incremental por data funciona igual.
 */
export class MockErpClient implements ErpClient {
  private cache = new Map<string, unknown>();

  constructor(private dir = join(process.cwd(), 'mock_erp')) {}

  private async ler<T>(arquivo: string): Promise<T> {
    if (!this.cache.has(arquivo)) {
      const bruto = await readFile(join(this.dir, arquivo), 'utf-8');
      this.cache.set(arquivo, JSON.parse(bruto));
    }
    return this.cache.get(arquivo) as T;
  }

  listVendedores() { return this.ler<Vendedor[]>('vendedores.json'); }
  listFamilias()   { return this.ler<Familia[]>('familias.json'); }
  listProdutos()   { return this.ler<Produto[]>('produtos.json'); }
  listEquipamentos() { return this.ler<Equipamento[]>('equipamentos.json'); }

  async listClientes(desde?: Date): Promise<Cliente[]> {
    const todos = await this.ler<Cliente[]>('clientes.json');
    // o campo _cenario existe só no mock, para teste. Removido aqui de propósito:
    // se vazar para o resto do sistema, o código passa a depender de algo que
    // o ERP real não tem.
    const limpos = todos.map(({ ...c }) => {
      delete (c as Record<string, unknown>)._cenario;
      return c;
    });
    if (!desde) return limpos;
    return limpos.filter((c) => new Date(c.data_cadastro) >= desde);
  }

  async listNotas(desde?: Date): Promise<Nota[]> {
    const todas = await this.ler<Nota[]>('notas.json');
    if (!desde) return todas;
    return todas.filter((n) => new Date(n.data_emissao) >= desde);
  }
}
