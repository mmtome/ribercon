/**
 * Assinatura da marca.
 *
 * Reconstruída em texto + SVG a partir do logotipo do site (azul #10406D com o
 * brilho de 4 pontas em azul claro), em vez de carregar o PNG: a marca aparece em
 * toda tela, e um raster de 15 KB no caminho crítico de um app usado em 4G de rua
 * não se paga. Ver docs/identidade-visual.md.
 *
 * No tema escuro o logotipo inverte — o texto vai a branco e o brilho fica no azul
 * claro da marca, que é o acento do sistema inteiro.
 */
export function Marca({ tamanho = 'md' }: { tamanho?: 'sm' | 'md' | 'lg' }) {
  const t = {
    sm: { grupo: 'text-[10px]', nome: 'text-[15px]', brilho: 11 },
    md: { grupo: 'text-[11px]', nome: 'text-[18px]', brilho: 13 },
    lg: { grupo: 'text-[13px]', nome: 'text-[24px]', brilho: 18 },
  }[tamanho];

  return (
    <span className="inline-flex items-baseline gap-1.5 select-none text-tinta">
      <span className="leading-none">
        <span className={`${t.grupo} font-normal text-texto`}>Grupo </span>
        <span className={`${t.nome} font-bold tracking-tight`}>RIBERCON</span>
      </span>
      <svg
        width={t.brilho}
        height={t.brilho}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="translate-y-[1px]"
      >
        <path
          d="M12 0 L14.1 9.9 L24 12 L14.1 14.1 L12 24 L9.9 14.1 L0 12 L9.9 9.9 Z"
          fill="#AAD5F6"
        />
      </svg>
    </span>
  );
}
