# Identidade visual — Grupo Ribercon

Extraída de `https://ribercon.com.br/` em 23/07/2026.
Fontes: `wp-content/themes/bootscore/assets/css/main.css` (overrides do tema sobre o
Bootstrap) e o logotipo `LOGO-Cabecalho-1.3.png`.

Este documento é a **fonte da verdade** dos tokens. Quem mexer em cor mexe aqui primeiro,
depois em [`src/app/globals.css`](../src/app/globals.css).

---

## Marca

| Item | Valor |
|---|---|
| Nome | **Grupo Ribercon** |
| Assinatura | *Soluções em Higiene Profissional* |
| Símbolo | estrela/brilho de 4 pontas em azul claro, à direita do logotipo |
| Sede | Ribeirão Preto — SP |
| Segmentos | Hotelaria, Alimentação, Lavanderias, Academias, Saúde, Escritórios, Educação, Indústria, Lazer |
| Marcas representadas | Unilever, Ecolab, Kimberly-Clark, Bralimpia, CIF, Comfort, Dove, Kleenex, OMO, Scott, WypAll |

O logotipo é `Grupo` em peso regular sobre `RIBERCON` em caixa alta e peso bold — a
hierarquia de dois níveis se repete no app (rótulo fraco + dado forte no card).

---

## Cores

### Institucionais (extraídas do CSS)

| Token | Hex | Onde aparece no site |
|---|---|---|
| `--rib-azul` | `#10406D` | cor primária do tema — botões, links, logotipo (93 ocorrências no CSS) |
| `--rib-azul-escuro` | `#0D3357` | hover e estado ativo dos botões primários |
| `--rib-azul-medio` | `#429DC1` | destaques secundários |
| `--rib-azul-claro` | `#AAD5F6` | ícones e badges sobre fundo azul (top bar, contador do carrinho) |
| `--rib-azul-neutro` | `#88A0B6` | textos de apoio sobre azul |

## Tema do app — escuro sobre a marca

O aplicativo usa **tema escuro**, não o branco do site. A referência de UX aprovada
(app fitness, blocos *bento* sobre fundo quase-preto com um acento vivo) é a linguagem
alvo — mas traduzida para a paleta da casa: **o fundo é o azul institucional levado
até quase o preto, e o acento é o azul claro do brilho do logotipo (`#AAD5F6`)**, no
papel que o verde-limão tem na referência.

Por que escuro e não o branco do site: a tela principal roda no celular do vendedor,
em rua, muitas vezes sob sol. Fundo escuro com números claros e poucos pontos de cor
viva cansa menos o olho numa lista lida dezenas de vezes por dia e faz o dado saltar.
O site institucional tem outro público e outro objetivo — não precisa ser o mesmo.

### Superfícies (da mais funda para a mais alta)

| Token | Hex | Uso |
|---|---|---|
| `fundo` | `#06101A` | fundo da tela (azul institucional escurecido) |
| `superficie` | `#0D1C2C` | o "bloco" bento — card, painel |
| `elevado` | `#15293D` | ladrilho de número, item de lista dentro do bloco |
| `borda` | `#1E3A54` | contorno dos blocos |
| `borda-forte` | `#2B4E6D` | contorno de elemento interativo |

Um leve brilho radial na cor `#429DC1` atrás do topo dá profundidade sem custar imagem.

### Marca e acento

| Token | Hex | Uso |
|---|---|---|
| `rib-azul` | `#10406D` | azul institucional — base das superfícies |
| `rib-medio` | `#429DC1` | destaques secundários, barras do gráfico |
| `rib-claro` | `#AAD5F6` | **acento** — botão principal, progresso, dado em foco |

O botão principal é o acento claro com texto escuro (`#06101A`) — contraste invertido,
como na referência, e mede 13:1, muito acima do mínimo de acessibilidade.

### Texto

| Token | Hex | Uso |
|---|---|---|
| `tinta` | `#EAF3FB` | título, número principal |
| `texto` | `#9CB3C8` | corpo |
| `fraco` | `#63819C` | rótulo, metadado |

### Estados

O site não tem paleta de estado. No tema escuro, as cores de estado são versões
**claras** — as escuras do tema claro (`#B42318` etc.) somem sobre fundo escuro.

| Token | Hex | Significado no app |
|---|---|---|
| `critico` | `#FF8172` | equipamento parado — receita vazando |
| `atencao` | `#FFC069` | atrasado / queda |
| `ok` | `#5FE3A1` | fechado, meta batida, cliente já na rota |

**Regra de acessibilidade:** cor nunca é o único canal. Todo card traz o rótulo do tipo
em texto (selo) ao lado do traço colorido — vendedor daltônico e tela sob sol de rua são
o mesmo problema. Ver seção 6.1 da especificação.

---

## Tipografia

O site usa a pilha de sistema do Bootstrap (`system-ui, -apple-system, "Segoe UI",
Roboto…`). O app mantém a mesma escolha: **fonte de sistema**.

Não é economia — é decisão de produto. A tela principal é usada em rua, em 4G ruim,
por vendedor com o celular na mão. Web font é uma requisição a mais e um *flash* de
texto invisível justo no primeiro carregamento do dia, que é o momento que decide se
o vendedor abre o app de novo amanhã.

| Uso | Tamanho | Peso |
|---|---|---|
| Número principal (contatos na fila) | 40–46px | 700, tabular |
| Nome do cliente no card | 18px | 600 |
| Valor em jogo | 19px | 700, tabular |
| Motivo do sinal | 14px | 500 |
| Linha de contexto (ciclo, última compra) | 13px | 400 |
| Rótulo de seção | 11px, `letter-spacing .08em`, caixa alta | 600 |

Números de dinheiro e de dias usam `font-variant-numeric: tabular-nums` — sem isso a
coluna de valores treme quando a fila anima.

---

## Forma e layout

- **Raios generosos:** blocos a 22px (`rounded-card`), ladrilhos a 18px, botões e selos
  em pílula. É o vocabulário da referência — cantos macios, nada anguloso.
- **Layout bento:** cada tela é um conjunto de blocos `superficie` sobre o `fundo`, com
  respiro entre eles. Sem sombra pesada; a separação vem da borda e do degrau de cor.
- **Traço colorido** de 4px colado na borda **esquerda** do card (não no topo): numa
  lista rolada com o polegar, a lateral é o que o olho varre primeiro.
- **Alvo de toque** mínimo de 52px (`h-toque`) em tudo que se clica — app usado em pé,
  segurando caixa.

## Responsividade

Uma base de código, três formatos, quebras pensadas por conteúdo e não por device:

- **Celular** (1 coluna) — resumo do dia compacto no topo, depois os cards.
- **Tablet** (`sm`, 2 colunas de card) — a fila de 10 cabe quase inteira; ver o fim é o
  que faz começar.
- **Desktop** (`lg`) — o resumo do dia descola para uma **coluna fixa** à esquerda,
  visível o tempo todo enquanto os cards rolam ao lado.

A gaveta de registro sobe de baixo no celular (o polegar alcança) e vira **diálogo
central** no desktop, com fechar por `Esc`. A fila continua **cortada em 10** em
qualquer largura — espaço sobrando não é motivo para alongar a lista (seção 5.4 da
especificação).
