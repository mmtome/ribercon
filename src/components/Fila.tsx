'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CardView } from '@/lib/dados';
import { Marca } from './Marca';
import { CardSinal } from './CardSinal';
import { SheetRegistro, type Registro } from './SheetRegistro';
import { Bloco, Ladrilho, Rotulo } from './ui';
import { reais, diaPorExtenso } from '@/lib/formato';
import { ROTULO_DESFECHO, type Desfecho } from '@/lib/rotulos';

interface Fechado {
  cliente_id: string;
  nome: string;
  desfecho: Desfecho;
  valor: number;
}

/**
 * Tela principal do vendedor.
 *
 * Estratégia de layout, e o porquê de cada quebra:
 *  - **celular** — coluna única. O resumo do dia vem antes dos cards, porque é o que
 *    responde "quanto falta" antes de o dedo começar a rolar.
 *  - **tablet** — os cards passam a duas colunas. A fila de 10 cabe quase inteira na
 *    tela, e ver o fim da lista é o que faz começar.
 *  - **desktop** — o resumo descola para uma coluna fixa à esquerda. Ele fica visível
 *    o tempo todo enquanto os cards rolam; é a mesma informação, mas parada.
 *
 * A fila continua cortada em 10 em qualquer tamanho de tela. Espaço sobrando não é
 * motivo para alongar a lista — ver seção 5.4 da especificação.
 */
export function Fila({
  cards: iniciais,
  vendedorId,
  vendedorNome,
  vendedores,
  hojeIso,
  naFilaDeEspera,
}: {
  cards: CardView[];
  vendedorId: string;
  vendedorNome: string;
  vendedores: { id: string; nome: string }[];
  hojeIso: string;
  naFilaDeEspera: number;
}) {
  const [cards, setCards] = useState(iniciais);
  const [aberto, setAberto] = useState<CardView | null>(null);
  const [saindo, setSaindo] = useState<string | null>(null);
  const [fechados, setFechados] = useState<Fechado[]>([]);

  const total = iniciais.length;
  const feitos = total - cards.length;
  const valorEmJogo = cards.reduce((s, c) => s + c.valor_esperado, 0);
  const criticos = cards.filter((c) => c.tipo === 'equip_ocioso').length;
  const naRota = cards.filter((c) =>
    c.ajustes.some((a) => a.rotulo.startsWith('Na sua rota hoje')),
  ).length;

  async function confirmar(card: CardView, r: Registro) {
    setAberto(null);
    setSaindo(card.cliente_id);

    setFechados((f) => [
      ...f,
      {
        cliente_id: card.cliente_id,
        nome: card.nome,
        desfecho: r.desfecho,
        valor: r.valor_pedido ?? 0,
      },
    ]);

    // o uuid nasce AQUI, no aparelho, e não no servidor. É o que torna o reenvio
    // seguro quando o registro sai da fila offline: o servidor deduplica por ele.
    const corpo = {
      uuid: crypto.randomUUID(),
      cliente_id: card.cliente_id,
      vendedor_id: vendedorId,
      ...r,
    };

    // otimista: o card sai da tela antes da resposta. Vendedor em rota com 4G ruim
    // não pode ficar olhando spinner — e o servidor é idempotente, então reenviar
    // depois não duplica nada.
    setTimeout(() => {
      setCards((c) => c.filter((x) => x.cliente_id !== card.cliente_id));
      setSaindo(null);
    }, 220);

    try {
      await fetch('/api/interacao', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      });
    } catch {
      // TODO sprint 4: enfileirar em IndexedDB e reenviar pelo service worker.
      // O uuid acima já está pronto para isso.
    }
  }

  const fechadoTotal = fechados.reduce((s, f) => s + f.valor, 0);
  const pct = total ? (feitos / total) * 100 : 100;

  return (
    <div className="min-h-dvh">
      <BarraTopo vendedorId={vendedorId} vendedores={vendedores} />

      <div
        className="mx-auto max-w-[1400px] px-3 sm:px-5 pb-16
                   lg:grid lg:grid-cols-[330px_minmax(0,1fr)] lg:gap-5 lg:items-start"
      >
        {/* ---- resumo do dia ---- */}
        <aside className="py-4 lg:sticky lg:top-[68px]">
          <Bloco className="p-5">
            <Rotulo>{diaPorExtenso(new Date(`${hojeIso}T00:00:00Z`))}</Rotulo>
            <p className="text-[13px] text-texto mt-1">{vendedorNome}</p>

            <p className="mt-4 text-[46px] font-bold tabular leading-none text-tinta">
              {cards.length}
            </p>
            <p className="text-[14px] text-texto -mt-0.5">
              {cards.length === 1 ? 'contato na fila' : 'contatos na fila'}
            </p>

            {/* a fila precisa ter fim VISÍVEL — sem isso ninguém começa */}
            <div
              className="mt-4 h-2 rounded-pill bg-elevado overflow-hidden"
              role="progressbar"
              aria-valuenow={feitos}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label={`${feitos} de ${total} contatos`}
            >
              <div
                className="h-full bg-rib-claro rounded-pill transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-fraco tabular">
              {feitos} de {total} registrados
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Ladrilho valor={reais(valorEmJogo)} rotulo="em jogo" tom="acento" />
              <Ladrilho
                valor={criticos}
                rotulo="equipamento parado"
                tom={criticos > 0 ? 'critico' : 'neutro'}
              />
            </div>
            {naRota > 0 && (
              <div className="mt-2.5">
                <Ladrilho valor={naRota} rotulo="já na sua rota de hoje" tom="ok" />
              </div>
            )}

            {naFilaDeEspera > 0 && (
              <p className="mt-4 text-[12px] text-fraco leading-snug">
                {naFilaDeEspera} clientes aguardam nos próximos dias. A fila é curta de
                propósito — o resto sobe amanhã, por prioridade.
              </p>
            )}
          </Bloco>
        </aside>

        {/* ---- cards ---- */}
        <main className="pb-6 lg:py-4">
          {cards.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 content-start">
              {cards.map((c) => (
                <CardSinal
                  key={c.cliente_id}
                  card={c}
                  saindo={saindo === c.cliente_id}
                  onRegistrar={() => setAberto(c)}
                />
              ))}
            </div>
          ) : (
            <FilaZerada fechados={fechados} total={fechadoTotal} />
          )}
        </main>
      </div>

      {aberto && (
        <SheetRegistro
          card={aberto}
          onFechar={() => setAberto(null)}
          onConfirmar={(r) => confirmar(aberto, r)}
        />
      )}
    </div>
  );
}

/**
 * Barra do topo. O seletor de vendedor é PROVISÓRIO — sai quando a autenticação
 * entrar (sprint 3) e o id passar a vir da sessão.
 */
function BarraTopo({
  vendedorId,
  vendedores,
}: {
  vendedorId: string;
  vendedores: { id: string; nome: string }[];
}) {
  return (
    <header
      className="sticky top-0 z-30 bg-fundo/85 backdrop-blur border-b border-borda
                 pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto max-w-[1400px] px-3 sm:px-5 h-[60px] flex items-center justify-between gap-3">
        <Marca />
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-pill bg-elevado border border-borda"
            title="seletor provisório — sai com a autenticação"
          >
            {vendedores.map((v) => (
              <Link
                key={v.id}
                href={`/fila?v=${v.id}`}
                aria-current={v.id === vendedorId ? 'page' : undefined}
                className={`px-2.5 h-8 grid place-items-center rounded-pill text-[12px]
                  font-semibold transition ${
                    v.id === vendedorId
                      ? 'bg-rib-claro text-fundo'
                      : 'text-fraco hover:text-texto'
                  }`}
              >
                {v.id}
              </Link>
            ))}
          </div>
          <Link
            href="/painel"
            className="h-9 px-3.5 grid place-items-center rounded-pill border border-borda
                       text-[13px] text-texto hover:border-borda-forte hover:text-tinta transition"
          >
            Painel
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Tela de fechamento. É o único momento de gamificação do MVP — e é de propósito
 * que seja só isto: ranking permanente vira cobrança, e cobrança faz o vendedor
 * fugir da ferramenta em vez de abri-la.
 */
function FilaZerada({ fechados, total }: { fechados: Fechado[]; total: number }) {
  const comprou = fechados.filter((f) => f.desfecho === 'comprou');

  return (
    <Bloco className="p-8 text-center anim-surge">
      <div
        className="mx-auto w-16 h-16 rounded-pill bg-ok/12 grid place-items-center
                   text-ok text-[30px] leading-none"
      >
        ✓
      </div>
      <h2 className="mt-5 text-[26px] font-bold text-tinta">Fila zerada.</h2>

      {fechados.length > 0 ? (
        <>
          <p className="mt-1 text-texto tabular">
            {fechados.length} {fechados.length === 1 ? 'contato' : 'contatos'}
            {comprou.length > 0 && (
              <>
                {' '}
                · <span className="text-ok font-semibold">{reais(total)} fechados</span>
              </>
            )}
          </p>
          <ul className="mt-6 mx-auto max-w-md text-left space-y-2">
            {fechados.map((f) => (
              <li
                key={f.cliente_id}
                className="flex items-center justify-between gap-3 bg-elevado rounded-tile
                           px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-tinta truncate">
                    {f.nome}
                  </span>
                  <span className="block text-[12px] text-fraco">
                    {ROTULO_DESFECHO[f.desfecho]}
                  </span>
                </span>
                {f.valor > 0 && (
                  <span className="tabular text-[15px] font-semibold text-ok whitespace-nowrap">
                    {reais(f.valor)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-texto">Nenhum contato pendente hoje.</p>
      )}
    </Bloco>
  );
}
