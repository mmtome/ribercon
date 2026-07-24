'use client';

import { useEffect, useState } from 'react';
import type { CardView } from '@/lib/dados';
import { DESFECHOS, type Desfecho } from '@/lib/rotulos';
import { BotaoAcento, Rotulo } from './ui';
import { reaisCent } from '@/lib/formato';

export interface Registro {
  desfecho: Desfecho;
  valor_pedido: number | null;
  adiar_para: string | null;
  observacao: string | null;
}

/**
 * Registro de resultado — o momento que decide se o sistema é usado amanhã.
 *
 * Regras que não podem ser afrouxadas (seção 1 da especificação):
 *  - **1 toque** fecha o caso. Só dois desfechos pedem um segundo passo, e mesmo
 *    esses já vêm preenchidos.
 *  - **Nenhum campo de texto é obrigatório.** Nunca. Foi campo obrigatório que
 *    esvaziou o CRM anterior.
 *  - Sem tela de confirmação e sem botão "salvar": fechou, saiu da fila.
 *
 * No celular sobe de baixo (o polegar alcança). No desktop vira um diálogo central,
 * porque gaveta colada na base de uma tela de 27" fica longe do olho e do cursor.
 */
export function SheetRegistro({
  card,
  onFechar,
  onConfirmar,
}: {
  card: CardView;
  onFechar: () => void;
  onConfirmar: (r: Registro) => void;
}) {
  const [passo, setPasso] = useState<'escolha' | 'comprou' | 'adiar' | 'perdeu'>('escolha');
  const [valor, setValor] = useState(
    (card.sugestao?.valor_estimado ?? card.valor_esperado).toFixed(2),
  );
  const [observacao, setObservacao] = useState('');

  // Esc fecha. Num app que também roda em desktop, não ter isso é o tipo de falta
  // que faz o usuário achar que a tela travou.
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onFechar]);

  function escolher(d: Desfecho) {
    if (d === 'comprou') return setPasso('comprou');
    if (d === 'adiou') return setPasso('adiar');
    if (d === 'perdeu_concorrente') return setPasso('perdeu');
    onConfirmar({ desfecho: d, valor_pedido: null, adiar_para: null, observacao: null });
  }

  function adiarPara(dias: number) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    onConfirmar({
      desfecho: 'adiou',
      valor_pedido: null,
      adiar_para: d.toISOString().slice(0, 10),
      observacao: null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Registrar resultado — ${card.nome}`}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm anim-surge"
      />

      <div
        className="relative w-full sm:max-w-md bg-superficie border border-borda
                   rounded-t-[26px] sm:rounded-card anim-sobe sm:anim-surge
                   pb-[env(safe-area-inset-bottom)] shadow-2xl shadow-black/50"
      >
        <div className="px-5 pt-3 pb-3">
          <div className="mx-auto w-10 h-1 rounded-pill bg-borda-forte mb-4 sm:hidden" />
          <p className="font-semibold text-[17px] text-tinta leading-tight">{card.nome}</p>
          <p className="text-[13px] text-fraco">
            {card.familia ?? card.segmento} · {card.cidade}/{card.uf}
          </p>
        </div>

        {passo === 'escolha' && (
          <div className="grid grid-cols-2 gap-2.5 p-4 pt-1">
            {DESFECHOS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => escolher(d.id)}
                className={`min-h-[68px] rounded-tile font-semibold text-[15px] px-2
                  border transition active:scale-[0.97]
                  ${d.tom === 'ok'
                    ? 'border-ok/30 bg-ok/10 text-ok hover:bg-ok/15'
                    : d.tom === 'ruim'
                    ? 'border-critico/30 bg-critico/10 text-critico hover:bg-critico/15'
                    : 'border-borda bg-elevado text-texto hover:border-borda-forte'}`}
              >
                {d.rotulo}
              </button>
            ))}
          </div>
        )}

        {passo === 'comprou' && (
          <form
            className="p-5 pt-1 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onConfirmar({
                desfecho: 'comprou',
                valor_pedido: Number(valor) || 0,
                adiar_para: null,
                observacao: null,
              });
            }}
          >
            <label className="block">
              <Rotulo>Valor do pedido</Rotulo>
              {/* já vem preenchido com a sugestão: o caso comum é confirmar, não digitar */}
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                autoFocus
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="mt-2 w-full h-16 px-4 rounded-tile bg-elevado border border-borda
                           text-[26px] font-bold tabular text-tinta
                           focus:outline-none focus:border-rib-claro"
              />
            </label>
            {card.sugestao && (
              <p className="text-[13px] text-fraco leading-snug">
                Sugerido: {card.sugestao.quantidade} {card.sugestao.unidade} ·{' '}
                {card.sugestao.descricao} · {reaisCent(card.sugestao.valor_estimado)}
              </p>
            )}
            <BotaoAcento type="submit" className="w-full h-16 text-[16px]">
              Confirmar
            </BotaoAcento>
          </form>
        )}

        {passo === 'adiar' && (
          <div className="p-4 pt-1 grid grid-cols-3 gap-2.5">
            {[
              { rotulo: 'Amanhã', dias: 1 },
              { rotulo: '3 dias', dias: 3 },
              { rotulo: '1 semana', dias: 7 },
            ].map((o) => (
              <button
                key={o.dias}
                type="button"
                onClick={() => adiarPara(o.dias)}
                className="min-h-[68px] rounded-tile border border-borda bg-elevado
                           font-semibold text-[15px] text-texto transition
                           active:scale-[0.97] hover:border-borda-forte"
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        )}

        {passo === 'perdeu' && (
          <div className="p-5 pt-1 space-y-4">
            {/* único desfecho que abre observação — e ainda assim OPCIONAL */}
            <label className="block">
              <Rotulo>
                Para quem? <span className="normal-case font-normal">(opcional)</span>
              </Rotulo>
              <input
                type="text"
                autoFocus
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="concorrente, motivo…"
                className="mt-2 w-full h-16 px-4 rounded-tile bg-elevado border border-borda
                           text-[16px] text-tinta placeholder:text-fraco
                           focus:outline-none focus:border-rib-claro"
              />
            </label>
            <p className="text-[13px] text-fraco">
              Este desfecho gera alerta imediato no painel do gestor.
            </p>
            <button
              type="button"
              onClick={() =>
                onConfirmar({
                  desfecho: 'perdeu_concorrente',
                  valor_pedido: null,
                  adiar_para: null,
                  observacao: observacao || null,
                })
              }
              className="w-full h-16 rounded-pill bg-critico text-fundo font-semibold text-[16px]
                         transition active:scale-[0.98] hover:brightness-105"
            >
              Registrar perda
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => (passo === 'escolha' ? onFechar() : setPasso('escolha'))}
          className="w-full h-12 text-[14px] text-fraco border-t border-borda
                     hover:text-texto transition"
        >
          {passo === 'escolha' ? 'Cancelar' : '← voltar'}
        </button>
      </div>
    </div>
  );
}
