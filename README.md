# Ribercon

Sistema de ativação comercial para o Grupo Ribercon — distribuidora de higiene e
limpeza profissional em modelo comodato.

Não é um CRM. É um **playbook diário**: o sistema calcula quem precisa ser contatado
hoje, entrega a lista pronta no celular do vendedor e registra o resultado em um toque.

> Especificação completa: [`docs/especificacao-tecnica.md`](docs/especificacao-tecnica.md)
> Identidade visual: [`docs/identidade-visual.md`](docs/identidade-visual.md)

---

## Começar

```bash
npm install
cp .env.example .env

npm run motor:testar     # roda o motor nos dados simulados — não precisa de banco
npm run dev              # sobe o app em http://localhost:3000
```

O primeiro comando deve terminar com `RESULTADO: OK`. Se terminar com `FALHOU`,
alguma regra do motor quebrou.

O app sobe **sem banco e sem credencial nenhuma**: com os drivers em `mock`, as três
fontes saem dos JSONs versionados. Autenticação ainda não existe — o vendedor vem de
`?v=V01` na URL, e há um seletor no rodapé da fila.

Para regerar os dados simulados:

```bash
npm run mock:gerar        # ERP (precisa de Python 3)
npm run mock:integracoes  # ALVO e Rota Exata (roda com o tsx do projeto)
```

Os dois usam semente fixa — o resultado é sempre idêntico. É isso que permite usar
os dados como teste de regressão.

---

## Estrutura

```
docs/especificacao-tecnica.md      escopo, telas, regras, roadmap, riscos
docs/identidade-visual.md          tokens de marca extraídos de ribercon.com.br
prisma/schema.prisma               modelo de dados completo

mock_erp/*.json                    ERP simulado (120 clientes, 4.719 notas)
mock_integracoes/*.json            ALVO e Rota Exata simulados
scripts/gerar_mock_erp.py          gerador do ERP simulado
scripts/gerar-mock-integracoes.ts  gerador das fontes externas
scripts/testar-motor.ts            teste de regressão do motor

src/lib/erp/                       fonte 1 — ERP RP
  types.ts                         o contrato (mock e real implementam o mesmo)
  mock-client.ts · rp-client.ts · index.ts → getErpClient()

src/lib/integracoes/               fontes 2 e 3 — ALVO e Rota Exata
  types.ts                         contratos das duas
  alvo/ · rota-exata/              mock + stub de cada
  index.ts                         getAlvoClient() · getRotaClient()

src/lib/motor/
  ciclo.ts                         ciclo de recompra por cliente × família
  sinais.ts                        regras, score e montagem da fila
  sugestao.ts                      pedido sugerido que vai montado no card
  contexto.ts                      ajuste do score pelas fontes externas

src/lib/dados.ts                   junta tudo e entrega o que a tela consome
src/app/                           fila, cliente 360, painel, modo ritual
```

---

## As três fontes

O diagnóstico lista três sistemas. Cada um responde uma pergunta diferente, e é o
cruzamento que produz a fila:

| Fonte | Responde | O que muda na fila |
|---|---|---|
| **ERP RP** | quem precisa comprar | gera o sinal: ciclo, atraso, equipamento parado |
| **ALVO** | quem *pode* comprar, e com qual argumento | crédito bloqueado derruba o score; campanha vigente sobe |
| **Rota Exata** | onde o vendedor já vai estar hoje | cliente na rota do dia sobe — custo de contato é zero |

Um sinal de recompra num cliente com crédito travado é trabalho jogado fora: o
vendedor liga, ouve "seu financeiro barrou meu pedido" e passa a desconfiar da fila
inteira. O ajuste está em [`src/lib/motor/contexto.ts`](src/lib/motor/contexto.ts),
com cada fator nomeado e **rotulado em português no card** — o vendedor lê por que
aquele cliente subiu.

---

## Quatro regras que não podem ser quebradas

**1. Nunca importe um client concreto.** Use `getErpClient()`, `getAlvoClient()` e
`getRotaClient()`. É isso que faz a troca de cada mock pelo sistema real ser uma
linha no `.env` em vez de uma refatoração.

**2. Nunca leia o campo `_cenario`** dos clientes fora de `scripts/`. Ele existe só
no mock, para teste. O ERP real não tem esse campo.

**3. Não aumente `TAMANHO_FILA`.** A fila é cortada em 10 de propósito. Fila longa é
lida como "impossível" e o vendedor para de abrir o app.

**4. Nenhum campo de texto é obrigatório.** Em lugar nenhum, nunca. Foi campo
obrigatório que esvaziou o CRM anterior.

---

## Ordem de trabalho

| # | Passo | Pronto quando |
|---|---|---|
| 1 | `npm run motor:testar` passa | você entendeu o que o motor produz |
| 2 | Subir Postgres, `npm run db:push` | tabelas criadas |
| 3 | Job de sync: ERP → banco | `select count(*) from nota` bate com o JSON |
| 4 | Persistir ciclos e sinais | tabela `sinal` populada pelo cron |
| 5 | Auth de verdade no lugar do `?v=` | vendedor entra e cai na própria fila |
| 6 | PWA: manifest, service worker, offline, push | funciona em modo avião |
| 7 | Fase 0 das três fontes | os stubs viram implementação |

---

## Status

- [x] Modelo de dados
- [x] Camada de ERP com mock e stub do real
- [x] Camada de ALVO e Rota Exata com mock e stub do real
- [x] Motor de sinais + teste de regressão
- [x] Enriquecimento por crédito, campanha, positivação e roteiro
- [x] Pedido sugerido montado no card
- [x] Telas: `/fila`, registro em 1 toque, fila zerada, `/cliente/[id]`, `/painel`, `/painel/ritual`
- [ ] Job de sincronismo e persistência (hoje o motor roda a cada requisição, em memória)
- [ ] Autenticação
- [ ] PWA: manifest, service worker, offline, push
