import { carregarBase, filaDoDia, HOJE } from '@/lib/dados';
import { Fila } from '@/components/Fila';
import { Marca } from '@/components/Marca';

/**
 * Tela principal do vendedor.
 *
 * PROVISÓRIO: o vendedor vem de `?v=V01` porque autenticação é o sprint 3. Quando o
 * login existir, o id sai da sessão e o seletor da barra some — é a única coisa
 * nesta tela que não vai para produção.
 */
export default async function PaginaFila({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const base = await carregarBase();
  const vendedorId = v ?? base.vendedores[0]?.id;
  const fila = vendedorId ? await filaDoDia(vendedorId) : null;

  if (!fila) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 text-center">
        <div>
          <Marca tamanho="lg" />
          <p className="mt-4 text-texto">Vendedor não encontrado.</p>
        </div>
      </main>
    );
  }

  return (
    <Fila
      cards={fila.cards}
      vendedorId={fila.vendedor.id}
      vendedorNome={fila.vendedor.nome}
      vendedores={base.vendedores.map((x) => ({ id: x.id, nome: x.nome }))}
      hojeIso={HOJE.toISOString().slice(0, 10)}
      naFilaDeEspera={fila.naFilaDeEspera}
    />
  );
}
