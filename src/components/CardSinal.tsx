'use client';

import Link from 'next/link';
import type { CardView } from '@/lib/dados';
import { APARENCIA, ROTULO } from '@/lib/rotulos';
import { Selo, BotaoAcento } from './ui';
import { reais, dataCurta, desvioEmTexto } from '@/lib/formato';

/**
 * Um card = um cliente. Nunca dois cards do mesmo cliente na mesma fila: ninguém
 * liga duas vezes para o mesmo lugar no mesmo dia.
 *
 * Ordem das linhas, de cima para baixo, é ordem de decisão:
 *   1. o tipo do sinal e quanto vale   → decide se vale abrir
 *   2. quem é                          → decide o tom da conversa
 *   3. de onde veio o número           → decide se confia no alerta
 *   4. o que ALVO e Rota Exata dizem   → decide o roteiro
 *   5. o pedido já montado             → decide o que oferecer
 *
 * O traço colorido é vertical e colado na borda esquerda: numa lista rolada com o
 * polegar, a lateral é o que o olho varre. Cor no topo do card só é vista depois de
 * o card já estar parado na tela.
 */
export function CardSinal({
  card,
  onRegistrar,
  saindo,
}: {
  card: CardView;
  onRegistrar: () => void;
  saindo: boolean;
}) {
  const ap = APARENCIA[card.tipo];
  const bloqueado = card.acao === 'resolver_credito';
  const naRotaHoje = card.ajustes.some((a) => a.rotulo.startsWith('Na sua rota hoje'));

  return (
    <article
      className={`relative bg-superficie border border-borda rounded-card overflow-hidden
                  flex flex-col ${saindo ? 'anim-some' : 'anim-surge'}`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${ap.traco}`} aria-hidden="true" />

      <div className="p-4 pl-5 space-y-3 flex-1">
        {/* 1. tipo + valor */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <Selo className={`${ap.selo} ${ap.texto}`}>{ROTULO[card.tipo]}</Selo>
            {naRotaHoje && (
              <Selo className="bg-rib-claro text-fundo">na rota hoje</Selo>
            )}
          </div>
          <span className="tabular font-bold text-[19px] text-tinta whitespace-nowrap leading-none">
            {card.valor_esperado > 0 ? reais(card.valor_esperado) : '—'}
          </span>
        </div>

        {/* 2. quem é */}
        <div>
          <h2 className="font-semibold text-[18px] leading-tight text-tinta">{card.nome}</h2>
          <p className="text-[13px] text-fraco mt-0.5">
            {card.familia ?? card.segmento}
            {card.dias_desvio !== 0 && (
              <span className={ap.texto}> · {desvioEmTexto(card.dias_desvio)}</span>
            )}
          </p>
        </div>

        {/* 3. de onde veio o número — é o que faz o vendedor confiar no alerta */}
        {card.ciclo_dias && (
          <p className="text-[13px] text-texto tabular">
            Compra a cada {Math.round(card.ciclo_dias)} dias
            {card.ultima_compra && <> · última {dataCurta(card.ultima_compra)}</>}
            {card.ultima_compra === null && card.dias_sem_comprar !== null && (
              <> · {card.dias_sem_comprar} dias sem consumo</>
            )}
            {card.origem_ciclo === 'segmento' && (
              <span className="text-fraco"> · estimado pelo segmento</span>
            )}
          </p>
        )}

        {/* o equipamento é a prova física do alerta: o vendedor confere a plaqueta */}
        {card.equipamento && (
          <p className="text-[13px] text-texto">
            {card.equipamento.tipo}
            {card.equipamento.numero_serie && (
              <span className="text-fraco tabular"> · sér. {card.equipamento.numero_serie}</span>
            )}
          </p>
        )}

        {/* 4. o que ALVO e Rota Exata acrescentam */}
        {card.ajustes.length > 0 && (
          <ul className="space-y-1.5">
            {card.ajustes.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
                <Selo
                  className={
                    a.fator < 1
                      ? 'bg-critico/15 text-critico'
                      : 'bg-rib-medio/15 text-rib-medio'
                  }
                >
                  {a.fonte}
                </Selo>
                <span className={a.fator < 1 ? 'text-critico' : 'text-texto'}>{a.rotulo}</span>
              </li>
            ))}
          </ul>
        )}

        {/* 5. o pedido já montado — a menos que a conversa seja outra */}
        {bloqueado ? (
          <p className="text-[13px] font-medium text-critico bg-critico/10 border border-critico/25
                        rounded-tile px-3 py-2.5">
            Resolver a pendência antes de ofertar. Oferecer produto agora queima o contato.
          </p>
        ) : card.sugestao ? (
          <div className="bg-elevado rounded-tile px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fraco">
              Pedido sugerido
            </p>
            <p className="text-[13px] text-tinta mt-1 leading-snug">
              <span className="tabular font-semibold">
                {card.sugestao.quantidade} {card.sugestao.unidade}
              </span>{' '}
              {card.sugestao.descricao}
            </p>
            <p className="text-[12px] text-rib-medio tabular mt-0.5">
              ≈ {reais(card.sugestao.valor_estimado)}
            </p>
          </div>
        ) : null}

        {/* Linhas secundárias cortadas em 3. Um cliente atrasado em 7 famílias gera 7
            sinais, e listar todos transforma o card num parágrafo — o vendedor para
            de ler. O detalhe completo está em /cliente. */}
        {card.secundarios.length > 0 && (
          <p className="text-[12px] text-fraco leading-snug">
            + {card.secundarios
              .slice(0, 3)
              .map((s) => `${ROTULO[s.tipo]}${s.familia ? ` (${s.familia})` : ''}`)
              .join(' · ')}
            {card.secundarios.length > 3 && <> · +{card.secundarios.length - 3} outros</>}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 pl-5 pt-0">
        <BotaoAcento type="button" onClick={onRegistrar} className="flex-1">
          Registrar
        </BotaoAcento>
        <Link
          href={`/cliente/${card.cliente_id}`}
          aria-label={`Ver ficha de ${card.nome}`}
          className="h-toque w-toque shrink-0 grid place-items-center rounded-pill
                     border border-borda-forte text-rib-claro text-[17px]
                     transition active:scale-95 hover:bg-elevado"
        >
          ›
        </Link>
      </div>
    </article>
  );
}
