import Link from 'next/link';
import { carregarBase, filaDoDia, HOJE } from '@/lib/dados';
import { todas as todasInteracoes } from '@/lib/interacoes';
import { Marca } from '@/components/Marca';
import { reais, diaPorExtenso } from '@/lib/formato';

export const dynamic = 'force-dynamic';

/**
 * Modo ritual — tela cheia para projetar na reunião diária de 10 minutos.
 *
 * Custa pouco e é o que faz o processo acontecer: a notificação push é lembrete, a
 * reunião é o gatilho real do sistema. Uma linha por vendedor, fonte grande o
 * suficiente para ler do fundo da sala, e nenhum número que precise de explicação.
 *
 * De propósito NÃO tem: ranking, meta individual, cor de reprovação. O ritual é
 * leitura da fila em voz alta, não cobrança — se virar cobrança, o vendedor passa a
 * evitar a ferramenta que gera o número.
 *
 * Esta é a única tela pensada para projetor, não para celular. Ainda assim ela cabe
 * num tablet: em telas estreitas as colunas de número passam a ficar embaixo do
 * nome, em vez de espremer a fonte até ninguém enxergar de longe.
 */
export default async function Ritual() {
  const base = await carregarBase();
  const interacoes = todasInteracoes();

  const linhas = await Promise.all(
    base.vendedores.map(async (v) => {
      const fila = await filaDoDia(v.id);
      const minhas = interacoes.filter((i) => i.vendedor_id === v.id);
      return {
        vendedor: v,
        total: fila?.cards.length ?? 0,
        feitos: minhas.length,
        fechado: minhas
          .filter((i) => i.desfecho === 'comprou')
          .reduce((s, i) => s + (i.valor_pedido ?? 0), 0),
        criticos: fila?.criticos ?? 0,
        emJogo: fila?.valorEmJogo ?? 0,
      };
    }),
  );

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-6 sm:px-10 pt-6 pb-5 flex flex-wrap items-center justify-between gap-3">
        <Marca tamanho="lg" />
        <p className="text-[15px] text-texto">{diaPorExtenso(HOJE)} · ritual diário</p>
      </header>

      <main className="flex-1 px-6 sm:px-10 space-y-3">
        {linhas.map((l) => (
          <div
            key={l.vendedor.id}
            className="bg-superficie border border-borda rounded-card px-6 py-5
                       flex flex-wrap items-center justify-between gap-x-10 gap-y-4"
          >
            <span className="text-[30px] sm:text-[38px] font-bold leading-none text-tinta">
              {l.vendedor.nome}
            </span>

            <div className="flex items-end gap-8 sm:gap-12">
              <Numero valor={l.total} rotulo="fila" />
              <Numero valor={l.feitos} rotulo="feitos" />
              <Numero
                valor={l.fechado > 0 ? reais(l.fechado) : '—'}
                rotulo="fechado"
                cor={l.fechado > 0 ? 'text-ok' : 'text-fraco'}
              />
              <Numero
                valor={l.criticos}
                rotulo="críticos"
                cor={l.criticos > 0 ? 'text-critico' : 'text-fraco'}
              />
            </div>
          </div>
        ))}

        <p className="pt-3 text-[17px] text-texto">
          Total em jogo hoje:{' '}
          <span className="tabular font-semibold text-rib-claro">
            {reais(linhas.reduce((s, l) => s + l.emJogo, 0))}
          </span>
          {' · '}
          <span className="tabular">{linhas.reduce((s, l) => s + l.criticos, 0)}</span>{' '}
          equipamentos parados na carteira
        </p>
      </main>

      <footer className="px-6 sm:px-10 py-5 text-[13px] text-fraco flex flex-wrap
                         justify-between gap-3">
        <span>Cada um: fila de ontem, o que fechou, o que travou.</span>
        <Link href="/painel" className="hover:text-texto transition">
          ← painel
        </Link>
      </footer>
    </div>
  );
}

function Numero({
  valor,
  rotulo,
  cor = 'text-tinta',
}: {
  valor: React.ReactNode;
  rotulo: string;
  cor?: string;
}) {
  return (
    <span className="text-right">
      <span className={`block text-[30px] sm:text-[38px] font-bold tabular leading-none ${cor}`}>
        {valor}
      </span>
      <span className="block text-[11px] uppercase tracking-[0.08em] text-fraco mt-2">
        {rotulo}
      </span>
    </span>
  );
}
