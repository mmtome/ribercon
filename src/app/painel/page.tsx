import Link from 'next/link';
import { carregarBase, filaDoDia, HOJE } from '@/lib/dados';
import { todas as todasInteracoes } from '@/lib/interacoes';
import { Marca } from '@/components/Marca';
import { Bloco, Rotulo, Ladrilho, Selo } from '@/components/ui';
import { ROTULO } from '@/lib/rotulos';
import { reais, dataCurta } from '@/lib/formato';
import { DRIVERS } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Painel do gestor. Quatro blocos, nada além — a especificação é explícita nisso,
 * e o motivo é o mesmo do corte da fila em 10: painel que mostra tudo não é olhado.
 *
 * O quinto bloco (fontes) não é métrica de negócio, é de operação: quando um sinal
 * some ou aparece torto, a primeira pergunta é "qual driver está ligado". Sem essa
 * linha na tela, essa pergunta vira um chamado para o fornecedor.
 */
export default async function Painel() {
  const base = await carregarBase();
  const interacoes = todasInteracoes();
  const hojeIso = HOJE.toISOString().slice(0, 10);

  const filas = await Promise.all(base.vendedores.map((v) => filaDoDia(v.id)));

  // --- 1. adesão: fila concluída por vendedor ---
  const adesao = base.vendedores.map((v, i) => {
    const fila = filas[i];
    const total = fila?.cards.length ?? 0;
    const feitos = interacoes.filter((x) => x.vendedor_id === v.id).length;
    return {
      vendedor: v,
      total,
      feitos: Math.min(feitos, total),
      pct: total ? Math.min(feitos, total) / total : 0,
      valorEmJogo: fila?.valorEmJogo ?? 0,
      espera: fila?.naFilaDeEspera ?? 0,
    };
  });

  // --- 2. conversão do sinal por tipo ---
  const porCliente = new Map(base.sinais.map((s) => [s.cliente_id, s.tipo]));
  const conversao = new Map<string, { trabalhados: number; comprou: number }>();
  for (const i of interacoes) {
    const tipo = porCliente.get(i.cliente_id);
    if (!tipo) continue;
    const atual = conversao.get(tipo) ?? { trabalhados: 0, comprou: 0 };
    atual.trabalhados++;
    if (i.desfecho === 'comprou') atual.comprou++;
    conversao.set(tipo, atual);
  }

  // --- 3. alertas críticos ---
  // Um cliente com dois dispensers parados gera dois sinais. Na lista do gestor isso
  // vira a mesma linha duas vezes e infla a percepção do problema — a contagem que
  // importa aqui é de CONTAS com receita vazando, não de equipamentos.
  const ociosos = [
    ...base.sinais
      .filter((s) => s.tipo === 'equip_ocioso')
      .sort((a, b) => b.score - a.score)
      .reduce(
        (m, s) => (m.has(s.cliente_id) ? m : m.set(s.cliente_id, s)),
        new Map<string, (typeof base.sinais)[number]>(),
      )
      .values(),
  ];
  const perdas = interacoes.filter((i) => i.desfecho === 'perdeu_concorrente');
  const bloqueados = base.fontes.credito.filter((c) => c.situacao === 'bloqueado');

  // --- 4. sinais envelhecendo fora do corte ---
  const foraDoCorte = adesao.reduce((s, a) => s + a.espera, 0);
  const totalEmJogo = adesao.reduce((s, a) => s + a.valorEmJogo, 0);

  const nome = (id: string) => base.clientes.find((c) => c.id === id)?.nome_fantasia ?? id;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-fundo/85 backdrop-blur border-b border-borda">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 h-[60px] flex items-center
                        justify-between gap-3">
          <div className="flex items-baseline gap-3 min-w-0">
            <Marca />
            <span className="text-[13px] text-fraco hidden sm:inline">
              Painel do gestor · {dataCurta(HOJE)}
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/painel/ritual"
              className="h-9 px-3.5 grid place-items-center rounded-pill bg-rib-claro
                         text-fundo text-[13px] font-semibold transition hover:brightness-105"
            >
              Modo ritual
            </Link>
            <Link
              href="/fila"
              className="h-9 px-3.5 grid place-items-center rounded-pill border border-borda
                         text-[13px] text-texto hover:border-borda-forte hover:text-tinta transition"
            >
              Fila
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-4 pb-16 space-y-3">
        {/* ---- números do dia ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Bloco className="p-4">
            <Ladrilho valor={reais(totalEmJogo)} rotulo="em jogo hoje" tom="acento"
              className="bg-transparent p-0" />
          </Bloco>
          <Bloco className="p-4">
            <Ladrilho valor={ociosos.length} rotulo="contas com equipamento parado"
              tom="critico" className="bg-transparent p-0" />
          </Bloco>
          <Bloco className="p-4">
            <Ladrilho valor={bloqueados.length} rotulo="clientes com crédito bloqueado"
              tom="atencao" className="bg-transparent p-0" />
          </Bloco>
          <Bloco className="p-4">
            <Ladrilho valor={foraDoCorte} rotulo="clientes na espera"
              className="bg-transparent p-0" />
          </Bloco>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* ---- 1. adesão ---- */}
          <Bloco className="p-5">
            <h2 className="text-[16px] font-semibold text-tinta">Fila concluída por vendedor</h2>
            <Rotulo className="mt-0.5">a métrica de adesão do piloto</Rotulo>

            <ul className="mt-4 space-y-2">
              {adesao.map((a) => (
                <li key={a.vendedor.id} className="bg-elevado rounded-tile px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] text-tinta">{a.vendedor.nome}</span>
                    <span className="text-[13px] tabular text-texto whitespace-nowrap">
                      {a.feitos}/{a.total} · {reais(a.valorEmJogo)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-pill bg-fundo overflow-hidden">
                    <div
                      className={`h-full rounded-pill ${a.pct >= 0.6 ? 'bg-ok' : 'bg-atencao'}`}
                      style={{ width: `${Math.max(a.pct * 100, 1.5)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <p className="text-[12px] text-fraco mt-4 leading-snug">
              Regra combinada com o cliente: abaixo de 60% por duas semanas seguidas, o canal
              é o problema e a Fase 2 passa a incluir WhatsApp.
            </p>
          </Bloco>

          {/* ---- 2. conversão ---- */}
          <Bloco className="p-5">
            <h2 className="text-[16px] font-semibold text-tinta">Conversão do sinal</h2>
            <Rotulo className="mt-0.5">% dos sinais trabalhados que viraram pedido</Rotulo>

            {conversao.size === 0 ? (
              <p className="text-[13px] text-fraco mt-6 leading-snug">
                Nenhuma interação registrada ainda. Este bloco enche sozinho conforme os
                vendedores usam a fila.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {[...conversao.entries()]
                  .sort((a, b) => b[1].trabalhados - a[1].trabalhados)
                  .map(([tipo, v]) => (
                    <li key={tipo} className="flex items-center gap-3 text-[14px]">
                      <span className="w-40 shrink-0 text-texto truncate">
                        {ROTULO[tipo as keyof typeof ROTULO]}
                      </span>
                      <div className="flex-1 h-2 rounded-pill bg-elevado overflow-hidden">
                        <div
                          className="h-full bg-rib-claro rounded-pill"
                          style={{ width: `${(v.comprou / v.trabalhados) * 100}%` }}
                        />
                      </div>
                      <span className="tabular text-fraco w-24 text-right text-[13px]">
                        {Math.round((v.comprou / v.trabalhados) * 100)}% de {v.trabalhados}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Bloco>

          {/* ---- 3. alertas críticos ---- */}
          <Bloco className="p-5">
            <h2 className="text-[16px] font-semibold text-critico">Alertas críticos</h2>
            <Rotulo className="mt-0.5">equipamento parado é receita vazando em silêncio</Rotulo>

            <ul className="mt-4 space-y-2">
              {ociosos.slice(0, 6).map((s, i) => (
                <li key={i}>
                  <Link
                    href={`/cliente/${s.cliente_id}`}
                    className="flex items-center justify-between gap-3 bg-elevado rounded-tile
                               px-4 py-3 hover:bg-borda transition"
                  >
                    <span className="text-[14px] text-tinta truncate">{nome(s.cliente_id)}</span>
                    {/* ordenado por SCORE (valor × urgência), não por dias — sem o valor
                        ao lado, a ordem parece errada para quem lê */}
                    <span className="text-[12px] tabular whitespace-nowrap">
                      <span className="text-texto">{reais(s.valor_esperado)}/ciclo</span>
                      <span className="text-critico">
                        {' '}· {String(s.motivo.dias_sem_consumo ?? '')}d parado
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {ociosos.length > 6 && (
              <p className="text-[12px] text-fraco mt-3">+{ociosos.length - 6} outras contas</p>
            )}

            {perdas.length > 0 && (
              <>
                <Rotulo className="mt-5 text-critico">Perdas para concorrente</Rotulo>
                <ul className="mt-2 space-y-1.5">
                  {perdas.map((p) => (
                    <li key={p.uuid} className="text-[13px] text-critico">
                      {nome(p.cliente_id)}
                      {p.observacao && <span className="text-texto"> — {p.observacao}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Bloco>

          {/* ---- 4. o que está envelhecendo ---- */}
          <Bloco className="p-5">
            <h2 className="text-[16px] font-semibold text-tinta">Sinais não trabalhados</h2>
            <Rotulo className="mt-0.5">o que ficou fora do corte de hoje</Rotulo>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Ladrilho valor={foraDoCorte} rotulo="clientes na espera" />
              <Ladrilho valor={base.sinais.length} rotulo="sinais gerados hoje" />
            </div>

            <ul className="mt-3 space-y-1.5 text-[14px]">
              {adesao
                .filter((a) => a.espera > 0)
                .sort((a, b) => b.espera - a.espera)
                .map((a) => (
                  <li key={a.vendedor.id} className="flex justify-between text-texto">
                    <span>{a.vendedor.nome}</span>
                    <span className="tabular text-fraco">{a.espera} aguardando</span>
                  </li>
                ))}
            </ul>

            <p className="text-[12px] text-fraco mt-4 leading-snug">
              Fila em espera não é atraso: é o corte proposital em 10 cards. Vira problema
              quando cresce semana após semana no mesmo vendedor.
            </p>
          </Bloco>
        </div>

        {/* ---- 5. fontes ---- */}
        <Bloco className="p-5">
          <h2 className="text-[16px] font-semibold text-tinta">Fontes de dados</h2>
          <Rotulo className="mt-0.5">qual driver está ligado agora</Rotulo>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Fonte nome="ERP RP" driver={DRIVERS.erp} detalhe={`${base.notas.length} notas`} />
            <Fonte
              nome="ALVO"
              driver={DRIVERS.alvo}
              detalhe={`${
                base.fontes.campanhas.filter((c) => c.inicio <= hojeIso && hojeIso <= c.fim).length
              } campanhas vigentes`}
            />
            <Fonte
              nome="Rota Exata"
              driver={DRIVERS.rota}
              detalhe={`${base.fontes.roteiros
                .filter((r) => r.data === hojeIso)
                .reduce((s, r) => s + r.paradas.length, 0)} paradas hoje`}
            />
          </div>
        </Bloco>
      </main>
    </div>
  );
}

function Fonte({ nome, driver, detalhe }: { nome: string; driver: string; detalhe: string }) {
  const simulado = driver === 'mock';
  return (
    <div className="bg-elevado rounded-tile px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-tinta text-[15px]">{nome}</p>
        <Selo className={simulado ? 'bg-atencao/15 text-atencao' : 'bg-ok/15 text-ok'}>
          {simulado ? 'simulado' : 'produção'}
        </Selo>
      </div>
      <p className="text-[12px] text-fraco tabular mt-1.5">{detalhe}</p>
    </div>
  );
}
