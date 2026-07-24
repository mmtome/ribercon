import type { ReactNode } from 'react';

/**
 * Peças compartilhadas do sistema visual.
 *
 * Existem para que fila, painel e cliente 360 usem exatamente o mesmo raio, a mesma
 * borda e o mesmo contraste. Sem isso, cada tela ganha um cinza levemente diferente
 * e o conjunto passa a parecer três produtos costurados — que é o defeito mais comum
 * em app de linha de negócio.
 */

/** Superfície padrão: o "bloco" do layout bento. */
export function Bloco({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div';
}) {
  return (
    <Tag
      className={`bg-superficie border border-borda rounded-card ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Rótulo de seção: pequeno, caixa alta, espaçado. Hierarquia sem peso visual. */
export function Rotulo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] text-fraco ${className}`}>
      {children}
    </p>
  );
}

/**
 * Ladrilho de número — o "stat tile" da referência.
 * Número grande em cima, rótulo pequeno embaixo: lê-se em um relance, de longe.
 */
export function Ladrilho({
  valor,
  rotulo,
  tom = 'neutro',
  className = '',
}: {
  valor: ReactNode;
  rotulo: string;
  tom?: 'neutro' | 'acento' | 'critico' | 'atencao' | 'ok';
  className?: string;
}) {
  const cor = {
    neutro: 'text-tinta',
    acento: 'text-rib-claro',
    critico: 'text-critico',
    atencao: 'text-atencao',
    ok: 'text-ok',
  }[tom];

  return (
    <div className={`bg-elevado rounded-tile px-3.5 py-3 min-w-0 ${className}`}>
      <p className={`text-[22px] font-bold tabular leading-none truncate ${cor}`}>{valor}</p>
      <p className="text-[11px] text-fraco mt-1.5 truncate">{rotulo}</p>
    </div>
  );
}

/** Selo compacto — usado para fonte de dado (ALVO / Rota Exata) e tipo de sinal. */
export function Selo({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center shrink-0 rounded-pill px-2 py-0.5
                  text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Botão principal. Acento claro com texto escuro — o mesmo contraste invertido que
 * a referência usa, e que aqui rende 13:1 sobre o azul claro da marca.
 */
export function BotaoAcento({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`h-toque rounded-pill bg-rib-claro text-fundo font-semibold text-[15px]
                  transition active:scale-[0.98] hover:brightness-105
                  disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
