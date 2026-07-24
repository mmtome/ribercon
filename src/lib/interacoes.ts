import type { Desfecho } from './rotulos';

/**
 * Registro das interações do vendedor — o "CRM" de verdade do projeto.
 *
 * PROVISÓRIO: guarda em memória do processo. Reiniciar o servidor apaga tudo. O
 * destino é a tabela `interacao` do Prisma, que já existe no schema.
 *
 * O que NÃO é provisório e precisa sobreviver à troca por banco:
 *
 *  1. **Idempotência por `uuid` gerado no cliente.** O uuid nasce no celular, não
 *     aqui. Sem isso, uma reconexão dupla no modo offline registra o mesmo pedido
 *     duas vezes — e o vendedor descobre isso pelo gestor cobrando um número errado.
 *  2. **`observacao` sempre opcional.** Campo de texto obrigatório é onde o CRM
 *     anterior morreu. Não reintroduza validação aqui.
 */

export interface Interacao {
  uuid: string;
  cliente_id: string;
  vendedor_id: string;
  desfecho: Desfecho;
  valor_pedido: number | null;
  adiar_para: string | null;
  observacao: string | null;
  registrado_em: string;
}

const registro = new Map<string, Interacao>();

export function registrar(i: Interacao): { novo: boolean; interacao: Interacao } {
  const existente = registro.get(i.uuid);
  if (existente) return { novo: false, interacao: existente };
  registro.set(i.uuid, i);
  return { novo: true, interacao: i };
}

export function doVendedorHoje(vendedorId: string, dia: string): Interacao[] {
  return [...registro.values()].filter(
    (i) => i.vendedor_id === vendedorId && i.registrado_em.startsWith(dia),
  );
}

export function todas(): Interacao[] {
  return [...registro.values()];
}

/** clientes já trabalhados hoje — saem da fila sem esperar recálculo do motor */
export function trabalhadosHoje(vendedorId: string, dia: string): Set<string> {
  return new Set(doVendedorHoje(vendedorId, dia).map((i) => i.cliente_id));
}
