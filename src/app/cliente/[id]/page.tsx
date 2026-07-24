import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dadosDoCliente, HOJE } from '@/lib/dados';
import { Marca } from '@/components/Marca';
import { Bloco, Rotulo, Ladrilho, Selo } from '@/components/ui';
import { ROTULO, APARENCIA } from '@/lib/rotulos';
import { reais, reaisCent, dataCurta, mesEixo } from '@/lib/formato';

/**
 * Cliente 360.
 *
 * O item que importa mais aqui não é o gráfico: é o rótulo de ORIGEM do ciclo em cada
 * família (`próprio` × `estimado pelo segmento`). Mostrar de onde veio o número é o
 * que faz o vendedor confiar no alerta — e um vendedor que não confia no alerta
 * simplesmente não liga.
 *
 * O layout é bento: no celular tudo empilha; no desktop os blocos se distribuem em
 * duas colunas com o histórico ocupando a largura toda, porque série temporal
 * espremida em meia tela deixa de ser legível.
 */
export default async function PaginaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await dadosDoCliente(id);
  if (!d) notFound();

  const pico = Math.max(...d.historico.map((h) => h.valor), 1);
  const totalAno = d.historico.reduce((s, h) => s + h.valor, 0);

  const tomCredito =
    d.credito?.situacao === 'bloqueado' ? 'critico'
    : d.credito?.situacao === 'atencao' ? 'atencao'
    : 'ok';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-fundo/85 backdrop-blur border-b border-borda
                         pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-[1100px] px-3 sm:px-5 h-[60px] flex items-center
                        justify-between gap-3">
          <Marca />
          <Link
            href="/fila"
            className="h-9 px-3.5 grid place-items-center rounded-pill border border-borda
                       text-[13px] text-texto hover:border-borda-forte hover:text-tinta transition"
          >
            ← Fila
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-3 sm:px-5 py-4 pb-16 space-y-3">
        {/* ---- identificação ---- */}
        <Bloco className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] sm:text-[28px] font-bold leading-tight text-tinta">
                {d.cliente.nome_fantasia}
              </h1>
              <p className="text-[13px] text-fraco mt-1">
                {d.cliente.segmento} · {d.cliente.cidade}/{d.cliente.uf} ·{' '}
                {d.vendedor?.nome ?? d.cliente.vendedor_id}
              </p>
            </div>
            <Selo className="bg-elevado text-fraco tabular">{d.cliente.cnpj}</Selo>
          </div>
        </Bloco>

        {/* ---- o que as fontes externas dizem ---- */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Bloco className="p-5">
            <Rotulo className="text-rib-medio">ALVO · crédito</Rotulo>
            {d.credito ? (
              <>
                <p
                  className={`mt-2 text-[24px] font-bold leading-none ${
                    tomCredito === 'critico' ? 'text-critico'
                    : tomCredito === 'atencao' ? 'text-atencao' : 'text-ok'
                  }`}
                >
                  {d.credito.situacao === 'bloqueado' ? 'Bloqueado'
                    : d.credito.situacao === 'atencao' ? 'Atenção' : 'Liberado'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <Ladrilho valor={reais(d.credito.saldo_devedor)} rotulo="saldo devedor" />
                  <Ladrilho valor={reais(d.credito.limite)} rotulo="limite" />
                </div>
                {d.credito.titulos_vencidos > 0 && (
                  <p className="mt-3 text-[13px] text-critico tabular">
                    {d.credito.titulos_vencidos} título(s) vencido(s) ·{' '}
                    {d.credito.maior_atraso_dias} dias de atraso
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-[13px] text-fraco">sem dado</p>
            )}
          </Bloco>

          <Bloco className="p-5">
            <Rotulo className="text-rib-medio">Rota Exata · visita</Rotulo>
            {d.frequencia?.canal === 'telefone' ? (
              <>
                <p className="mt-2 text-[24px] font-bold leading-none text-texto">Telefone</p>
                <p className="mt-2 text-[13px] text-fraco leading-snug">
                  Cliente sem visita presencial programada — o contato é remoto.
                </p>
              </>
            ) : d.proximaVisita ? (
              <>
                <p className="mt-2 text-[24px] font-bold leading-none tabular text-tinta">
                  {dataCurta(d.proximaVisita.data)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <Ladrilho valor={`#${d.proximaVisita.sequencia}`} rotulo="parada do roteiro" />
                  <Ladrilho
                    valor={d.frequencia?.dias_semana.length ?? 0}
                    rotulo="visitas por semana"
                  />
                </div>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-fraco">sem visita programada</p>
            )}
          </Bloco>
        </div>

        {/* ---- histórico ---- */}
        <Bloco className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <Rotulo>Compras por mês</Rotulo>
            <span className="text-[13px] tabular text-texto">
              {reais(totalAno)} em 12 meses
            </span>
          </div>
          {d.historico.length > 0 ? (
            <div className="flex items-end gap-1.5 h-32 mt-4">
              {d.historico.map((h) => (
                <div key={h.mes} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                  <div
                    className="w-full bg-rib-medio/60 hover:bg-rib-claro rounded-t-md transition-colors"
                    style={{ height: `${Math.max(4, (h.valor / pico) * 100)}px` }}
                    title={`${mesEixo(h.mes)}: ${reaisCent(h.valor)}`}
                  />
                  <span className="text-[10px] text-fraco w-full text-center">
                    {mesEixo(h.mes)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-fraco">sem compras no período</p>
          )}
        </Bloco>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* ---- ciclo por família, com a ORIGEM do cálculo ---- */}
          <Bloco className="p-5">
            <Rotulo>Ciclo de recompra por família</Rotulo>
            <ul className="mt-3 space-y-2">
              {d.ciclos.length === 0 && (
                <li className="text-[13px] text-fraco">sem ciclo calculável ainda</li>
              )}
              {d.ciclos
                .sort((a, b) => b.ticket_medio - a.ticket_medio)
                .map((c) => (
                  <li
                    key={c.familia_id}
                    className="flex items-center justify-between gap-3 bg-elevado
                               rounded-tile px-3.5 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px] text-tinta truncate">
                        {d.familias.get(c.familia_id)?.nome ?? c.familia_id}
                      </span>
                      <span className="block text-[12px] text-fraco tabular mt-0.5">
                        última {dataCurta(new Date(c.ultima_compra))} · {c.n_compras} compras
                      </span>
                      {/* a origem é o que dá credibilidade ao número */}
                      <Selo
                        className={`mt-1.5 ${
                          c.origem === 'proprio'
                            ? 'bg-rib-medio/15 text-rib-medio'
                            : 'bg-white/5 text-fraco'
                        }`}
                      >
                        {c.origem === 'proprio' ? 'histórico próprio' : 'estimado pelo segmento'}
                      </Selo>
                    </span>
                    <span className="text-right whitespace-nowrap">
                      <span className="block text-[17px] font-bold tabular text-tinta">
                        {Math.round(c.mediana_dias)}d
                      </span>
                      <span className="block text-[12px] text-fraco tabular">
                        {reais(c.ticket_medio)}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </Bloco>

          <div className="space-y-3">
            {/* ---- parque em comodato ---- */}
            <Bloco className="p-5">
              <Rotulo>Comodato · {d.equipamentos.length} equipamento(s)</Rotulo>
              <ul className="mt-3 space-y-2">
                {d.equipamentos.length === 0 && (
                  <li className="text-[13px] text-fraco">nenhum equipamento instalado</li>
                )}
                {d.equipamentos.map((e) => {
                  const vence = new Date(
                    new Date(e.ultima_manutencao).getTime() +
                      e.intervalo_preventivo_dias * 86_400_000,
                  );
                  const atrasada = vence < HOJE;
                  return (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 bg-elevado
                                 rounded-tile px-3.5 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-[14px] text-tinta">
                          {e.tipo.replace(/_/g, ' ')}
                          {e.quantidade > 1 && (
                            <span className="text-fraco tabular"> ×{e.quantidade}</span>
                          )}
                        </span>
                        <span className="block text-[12px] text-fraco tabular mt-0.5">
                          sér. {e.numero_serie} · instalado {dataCurta(e.data_instalacao)}
                        </span>
                      </span>
                      <Selo
                        className={
                          atrasada
                            ? 'bg-atencao/15 text-atencao tabular'
                            : 'bg-white/5 text-fraco tabular'
                        }
                      >
                        {atrasada ? 'manut. vencida' : `manut. ${dataCurta(vence)}`}
                      </Selo>
                    </li>
                  );
                })}
              </ul>
            </Bloco>

            {/* ---- sinais abertos ---- */}
            <Bloco className="p-5">
              <Rotulo>Sinais abertos · {d.sinais.length}</Rotulo>
              <ul className="mt-3 space-y-2">
                {d.sinais.length === 0 && (
                  <li className="text-[13px] text-fraco">nenhum sinal aberto</li>
                )}
                {d.sinais
                  .sort((a, b) => b.score - a.score)
                  .map((s, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 min-w-0">
                        <Selo className={`${APARENCIA[s.tipo].selo} ${APARENCIA[s.tipo].texto}`}>
                          {ROTULO[s.tipo]}
                        </Selo>
                        {s.familia_id && (
                          <span className="text-[13px] text-texto truncate">
                            {d.familias.get(s.familia_id)?.nome}
                          </span>
                        )}
                      </span>
                      <span className="text-[12px] text-fraco tabular whitespace-nowrap">
                        {Math.round(s.score)}
                        {s.score !== s.score_base && (
                          <span className="text-fraco/70"> ← {Math.round(s.score_base)}</span>
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
              {d.sinais.some((s) => s.score !== s.score_base) && (
                <p className="mt-3 text-[11px] text-fraco leading-snug">
                  A seta mostra a nota antes das fontes externas. A diferença é o ajuste
                  de crédito, campanha e roteiro.
                </p>
              )}
            </Bloco>
          </div>
        </div>
      </div>
    </div>
  );
}
