import type { Config } from 'tailwindcss';

/**
 * Sistema visual — tema escuro sobre a marca Ribercon.
 * Ver docs/identidade-visual.md. Não invente cor aqui: atualize o doc primeiro.
 *
 * A base é o azul institucional #10406D levado até quase o preto, e o acento é o
 * azul claro do brilho do logotipo (#AAD5F6). É o mesmo esquema de uma cor viva
 * sobre fundo escuro que a referência usa — só que na paleta da casa, e não numa
 * cor emprestada de outra marca.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // superfícies, da mais funda para a mais alta
        fundo: '#06101A',
        superficie: '#0D1C2C',
        elevado: '#15293D',
        borda: '#1E3A54',
        'borda-forte': '#2B4E6D',

        // marca
        rib: {
          azul: '#10406D',
          medio: '#429DC1',
          claro: '#AAD5F6',
        },

        // texto
        tinta: '#EAF3FB',
        texto: '#9CB3C8',
        fraco: '#63819C',

        // estados — versões claras, legíveis sobre fundo escuro
        critico: '#FF8172',
        atencao: '#FFC069',
        ok: '#5FE3A1',
      },
      fontFamily: {
        sans: [
          'system-ui', '-apple-system', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      borderRadius: {
        card: '22px',
        tile: '18px',
        pill: '999px',
      },
      spacing: {
        // altura mínima de alvo de toque para quem usa o app em pé, na rua
        toque: '52px',
      },
    },
  },
  plugins: [],
} satisfies Config;
