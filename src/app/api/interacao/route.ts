import { NextResponse } from 'next/server';
import { registrar, type Interacao } from '@/lib/interacoes';
import { DESFECHOS, type Desfecho } from '@/lib/rotulos';

const VALIDOS = new Set<string>(DESFECHOS.map((d) => d.id));

/**
 * Registro de interação.
 *
 * **Idempotente por `uuid`.** O uuid é gerado no celular antes de sair da tela, e
 * repetir a mesma chamada devolve 200 com `duplicado: true` em vez de gravar de novo.
 * É isso que torna seguro o reenvio da fila offline: o service worker pode tentar
 * quantas vezes quiser sem risco de duplicar pedido.
 */
export async function POST(req: Request) {
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'json inválido' }, { status: 400 });
  }

  const { uuid, cliente_id, vendedor_id, desfecho } = corpo as Record<string, string>;

  if (!uuid || !cliente_id || !vendedor_id || !desfecho) {
    return NextResponse.json(
      { erro: 'uuid, cliente_id, vendedor_id e desfecho são obrigatórios' },
      { status: 400 },
    );
  }
  if (!VALIDOS.has(desfecho)) {
    return NextResponse.json({ erro: `desfecho "${desfecho}" desconhecido` }, { status: 400 });
  }

  const interacao: Interacao = {
    uuid,
    cliente_id,
    vendedor_id,
    desfecho: desfecho as Desfecho,
    valor_pedido: typeof corpo.valor_pedido === 'number' ? corpo.valor_pedido : null,
    adiar_para: typeof corpo.adiar_para === 'string' ? corpo.adiar_para : null,
    // observação NUNCA é obrigatória — ver src/lib/interacoes.ts
    observacao: typeof corpo.observacao === 'string' && corpo.observacao.trim()
      ? corpo.observacao.trim()
      : null,
    registrado_em: new Date().toISOString(),
  };

  const { novo } = registrar(interacao);
  return NextResponse.json({ ok: true, duplicado: !novo }, { status: novo ? 201 : 200 });
}
