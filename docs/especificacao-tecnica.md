# MVP "Ciclo" — Especificação técnica

Sistema de ativação comercial para distribuidora de higiene e limpeza profissional
(modelo comodato). Documento de escopo para desenvolvimento.

> **Versão:** 1.0 · **Data:** julho/2026
> **Contexto:** substitui a proposta de app com CRM tradicional. Sem WhatsApp API no MVP.

---

## 0. Decisão de plataforma

**Web app instalável (PWA). Não app nativo.**

| Critério | PWA | Nativo (iOS + Android) |
|---|---|---|
| Bases de código | 1 | 2 (+ o painel web do gestor = 3) |
| Prazo até o piloto | 4–6 semanas | 12+ semanas |
| Publicação / atualização | deploy, instantâneo | revisão de loja, dias |
| Push no Android | sim, nativo | sim |
| Push no iOS | só se instalado na tela inicial | sim |
| Uso no desktop (gestor) | mesmo código | precisa de um web à parte |

A única desvantagem real é o push no iPhone, que exige o usuário adicionar à tela
inicial. Isso se resolve no **onboarding presencial** (item 8), não em código.

### Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | front, API e cron num repo só |
| Banco | **PostgreSQL** (Supabase no MVP) | auth, RLS e realtime prontos; migra pra VPS depois |
| ORM | Prisma | migrations versionadas, tipagem automática |
| UI | Tailwind + shadcn/ui | velocidade; o MVP não precisa de design system próprio |
| PWA | Serwist (`@serwist/next`) | service worker sem configuração manual |
| Push | Web Push nativo (VAPID, lib `web-push`) | zero custo, sem Firebase, sem Meta |
| Jobs | Vercel Cron (ou `node-cron` na VPS) | roda o motor de sinais 1×/dia |
| Deploy | Vercel no piloto → Docker em VPS na entrega | cliente fica dono da infra |

**Custo de infra no piloto: R$ 0 a R$ 120/mês.** Sem licença, sem MRR obrigatório,
tudo migrável para servidor do cliente — que era a exigência do Guilherme.

---

## 1. O princípio que não pode ser violado

> **O sistema entrega trabalho pronto antes de pedir qualquer dado.**

O CRM atual está vazio porque pede digitação e não devolve nada. Toda decisão de
produto aqui passa por esse filtro. Na prática:

1. Nenhum campo de texto é obrigatório. Nunca.
2. Todo registro de resultado acontece em **1 toque**.
3. A fila do dia é **curta e finita** (máx. 10 cards) e tem um fim visível.
4. O card já chega com o motivo e com o pedido sugerido montado.

Se uma funcionalidade nova quebrar um desses quatro pontos, ela fica fora do MVP.

---

## 2. Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  FONTES (hoje: simuladas)                                │
│  ERP RP · ALVO · Rota Exata                              │
└────────────────────────┬─────────────────────────────────┘
                         │  interface ErpClient
┌────────────────────────▼─────────────────────────────────┐
│  SINCRONISMO      job diário · idempotente · upsert      │
├──────────────────────────────────────────────────────────┤
│  BASE UNIFICADA   Postgres — espelho, nunca a verdade    │
├──────────────────────────────────────────────────────────┤
│  MOTOR DE SINAIS  ciclo de recompra · ocioso · queda     │
│                   preventiva · score de prioridade       │
├──────────────────────────────────────────────────────────┤
│  FILA             sinais atribuídos a vendedor por dia   │
└────────┬──────────────────────┬──────────────────────────┘
         │                      │
   ┌─────▼──────┐        ┌──────▼───────┐
   │ PWA        │        │ Painel       │
   │ vendedor   │        │ gestor       │
   └────────────┘        └──────────────┘
```

**Regra de ouro:** o ERP é a fonte da verdade. O sistema **só lê**. Nada é escrito
de volta no MVP. Isso elimina a categoria inteira de risco "o app corrompeu o ERP",
que é o que mata a confiança do cliente em projeto de integração.

---

## 3. Camada de ERP simulada

Esta é a parte mais importante do documento. Feito certo, trocar o mock pelo ERP real
depois é **mudar uma variável de ambiente**.

### 3.1 Contrato (port)

```ts
// src/lib/erp/types.ts
export interface Cliente {
  id: string; cnpj: string; razao_social: string; nome_fantasia: string;
  segmento: string; cidade: string; uf: string;
  vendedor_id: string; data_cadastro: string; ativo: boolean;
}

export interface NotaItem {
  produto_id: string; familia_id: string;
  quantidade: number; valor_unitario: number; valor_total: number;
}

export interface Nota {
  id: string; numero: string; cliente_id: string;
  data_emissao: string; valor_total: number; itens: NotaItem[];
}

export interface Equipamento {
  id: string; cliente_id: string; tipo: string;
  familia_consumivel_id: string; numero_serie: string; quantidade: number;
  data_instalacao: string; ultima_manutencao: string;
  intervalo_preventivo_dias: number; status: 'ativo' | 'retirado' | 'manutencao';
}

export interface ErpClient {
  listClientes(desde?: Date): Promise<Cliente[]>;
  listProdutos(): Promise<Produto[]>;
  listFamilias(): Promise<Familia[]>;
  listVendedores(): Promise<Vendedor[]>;
  listNotas(desde?: Date): Promise<Nota[]>;
  listEquipamentos(): Promise<Equipamento[]>;
}
```

### 3.2 Implementações (adapters)

```ts
// src/lib/erp/index.ts
export function getErpClient(): ErpClient {
  return process.env.ERP_DRIVER === 'rp'
    ? new RpErpClient(process.env.ERP_BASE_URL!, process.env.ERP_TOKEN!)
    : new MockErpClient();   // padrão
}
```

`MockErpClient` lê os JSONs de `/mock_erp/`. `RpErpClient` fica como stub com
`throw new Error('não implementado')` em cada método — **crie o arquivo agora**,
mesmo vazio. Ele é o checklist do que perguntar na Fase 0 com o fornecedor do ERP.

### 3.3 Dados simulados

O gerador `gerar_mock_erp.py` (entregue junto) produz:

| Arquivo | Registros | Conteúdo |
|---|---|---|
| `clientes.json` | 120 | 8 segmentos, 6 cidades, 4 vendedores |
| `produtos.json` | 10 | SKUs reais do ramo, com preço de tabela |
| `familias.json` | 7 | com o vínculo família ↔ tipo de dispenser |
| `notas.json` | ~4.700 | 20 meses de histórico, ~12.000 itens |
| `equipamentos.json` | ~215 | parque em comodato, com data de manutenção |

O gerador usa `random.seed(42)`: rodar de novo produz exatamente os mesmos dados.
Isso permite escrever teste automatizado em cima deles.

**Cenários plantados de propósito** — o motor tem obrigação de encontrar todos:

| Cenário | Qtd | O que o motor deve fazer |
|---|---|---|
| `em_janela` | 21 | entrar na fila nos próximos 7 dias |
| `atrasado` | 17 | entrar na fila com urgência alta |
| `em_queda` | 13 | sinal de risco de perda |
| `novo` | 12 | cadência fixa (sem ciclo calculável) |
| `equip_ocioso` | 10 | **alerta crítico** — dispenser sem consumo |
| `perdido` | 9 | fila de recuperação, prioridade baixa |
| `normal` | 38 | não gerar ruído |

O campo `_cenario` existe **só no mock** e serve para teste. O ERP real não tem esse
campo — nunca leia ele em código de produção.

---

## 4. Modelo de dados

```sql
-- ===== ESPELHO DO ERP (só escrita pelo job de sync) =====
create table cliente (
  id            text primary key,
  cnpj          text, razao_social text, nome_fantasia text,
  segmento      text not null,
  cidade        text, uf text,
  vendedor_id   text references vendedor(id),
  data_cadastro date, ativo boolean default true,
  sincronizado_em timestamptz default now()
);

create table familia   (id text primary key, nome text, tipo_dispenser text);
create table produto   (id text primary key, descricao text,
                        familia_id text references familia(id),
                        preco_tabela numeric(12,2), unidade text);
create table vendedor  (id text primary key, nome text, ativo boolean default true);

create table nota (
  id text primary key, numero text,
  cliente_id text references cliente(id),
  data_emissao date not null, valor_total numeric(12,2)
);
create table nota_item (
  id bigserial primary key,
  nota_id text references nota(id) on delete cascade,
  produto_id text references produto(id),
  familia_id text references familia(id),
  quantidade numeric(12,3), valor_unitario numeric(12,2), valor_total numeric(12,2)
);
create index on nota_item (familia_id);
create index on nota (cliente_id, data_emissao desc);

create table equipamento (
  id text primary key,
  cliente_id text references cliente(id),
  tipo text, familia_consumivel_id text references familia(id),
  numero_serie text, quantidade int,
  data_instalacao date, ultima_manutencao date,
  intervalo_preventivo_dias int default 180,
  status text default 'ativo'
);

-- ===== CALCULADO PELO MOTOR (recriado a cada rodada) =====
create table ciclo_cliente_familia (
  cliente_id   text references cliente(id),
  familia_id   text references familia(id),
  n_compras    int  not null,
  mediana_dias numeric(8,2),
  desvio_dias  numeric(8,2),
  origem       text not null,   -- 'proprio' | 'segmento'
  ultima_compra date,
  ticket_medio numeric(12,2),
  primary key (cliente_id, familia_id)
);

create table sinal (
  id           bigserial primary key,
  tipo         text not null,   -- recompra|atrasado|equip_ocioso|queda|preventiva|cadencia
  cliente_id   text references cliente(id),
  familia_id   text references familia(id),
  equipamento_id text references equipamento(id),
  vendedor_id  text references vendedor(id),
  data_prevista date,
  dias_desvio  int,             -- + = atrasado, - = antecipado
  valor_esperado numeric(12,2),
  score        numeric(10,4) not null,
  motivo       jsonb not null,  -- dados p/ renderizar o card, sem novo query
  status       text default 'aberto',  -- aberto|trabalhado|adiado|descartado
  gerado_em    timestamptz default now(),
  unique (cliente_id, familia_id, tipo, data_prevista)
);
create index on sinal (vendedor_id, status, score desc);

-- ===== REGISTRADO PELO VENDEDOR (o "CRM" de verdade) =====
create table interacao (
  id          bigserial primary key,
  sinal_id    bigint references sinal(id),
  cliente_id  text references cliente(id),
  vendedor_id text references vendedor(id),
  desfecho    text not null,
  -- comprou | vai_comprar | nao_atendeu | adiou | sem_necessidade | perdeu_concorrente
  valor_pedido numeric(12,2),
  adiar_para  date,
  observacao  text,             -- SEMPRE opcional
  registrado_em timestamptz default now()
);
create index on interacao (vendedor_id, registrado_em desc);

create table push_subscription (
  id bigserial primary key,
  vendedor_id text references vendedor(id),
  endpoint text unique, p256dh text, auth text,
  criado_em timestamptz default now()
);
```

---

## 5. Motor de sinais

Roda 1×/dia, **05:30**, antes do expediente. Idempotente: rodar duas vezes no mesmo
dia não duplica sinal (garantido pelo `unique` da tabela).

### 5.1 Cálculo do ciclo de recompra

Para cada par **(cliente, família)** — nunca por cliente só, porque cada produto tem
consumo diferente:

```
intervalos = diferença em dias entre compras consecutivas da família
se n_compras >= 3:
    mediana_dias = mediana(intervalos)          origem = 'proprio'
senão:
    mediana_dias = mediana do (segmento, família)   origem = 'segmento'
```

Mediana, não média: uma compra atípica (feriado, promoção, estoque de fim de ano)
destrói a média e não mexe na mediana.

### 5.2 Regras de geração

| Tipo | Condição | Urgência |
|---|---|---|
| `recompra` | `hoje >= última + mediana − LEAD_TIME` (LEAD_TIME = 5 dias) | média |
| `atrasado` | `dias_desde_última > mediana × 1,15` | alta |
| `equip_ocioso` | equipamento `ativo` + família do refil parada há `> mediana × 2,5` | **crítica** |
| `queda` | ≥6 compras e média dos últimos 3 intervalos > 1,5 × mediana histórica | alta |
| `preventiva` | `ultima_manutencao + intervalo_preventivo` vence em ≤15 dias | média |
| `cadencia` | `n_compras < 3` e sem contato há 30 dias | baixa |
| — | `dias_desde_última > mediana × 3` | rebaixa para prioridade baixa (recuperação) |

### 5.3 Score de prioridade

```
valor_esperado = ticket_medio(cliente, família)
urgencia = clamp(dias_desvio / mediana_dias, -0.5, 2.0) + 1
peso_tipo = { equip_ocioso: 3.0, atrasado: 1.6, queda: 1.5,
              recompra: 1.0, preventiva: 0.9, cadencia: 0.5 }

score = valor_esperado × urgencia × peso_tipo[tipo]
```

### 5.4 Montagem da fila

1. Filtra sinais `aberto` do vendedor.
2. Ordena por `score` desc.
3. **Corta em 10.** O resto fica para amanhã.
4. Deduplica por cliente: um cliente aparece **uma vez** na fila, com o sinal de maior
   score, e os demais entram como linhas secundárias dentro do mesmo card.

O corte em 10 não é economia de tela — é o item que decide a adesão. Fila de 60
clientes é lida como "impossível" e ninguém começa.

### 5.5 Teste de aceite do motor

Rodando contra o mock, o motor tem que atingir:

- 100% dos `atrasado` detectados
- ≥90% dos `em_janela` detectados
- 100% dos `equip_ocioso` detectados
- todos os 12 `novo` classificados como `cadencia`, nenhum como `recompra`

O script `validar.py` (entregue junto) já faz essa medição.

---

## 6. Telas

### 6.1 Fila do dia — `/fila` (vendedor, mobile)

Tela principal. Abre direto nela após o login.

- Cabeçalho: `Quarta, 23/07 · 7 contatos · R$ 12.400 em jogo`
- Barra de progresso mostrando quantos faltam.
- Lista de cards, um por cliente, ordem de score.

**Card:**
```
┌─────────────────────────────────────┐
│ 🔴 Hospital São Vida       R$ 2.840 │
│ Refil sabonete · 12 dias atrasado   │
│ Compra a cada 41 dias · última 15/06│
│ Pedido sugerido: 24un PRD002        │
│ [ Registrar ]              [ Ver ▸ ]│
└─────────────────────────────────────┘
```

Cor da borda pelo tipo: crítico (equipamento ocioso) = vermelho, atrasado = âmbar,
recompra = neutro. Nunca use só a cor — o rótulo em texto vem junto.

### 6.2 Registro — bottom sheet, 1 toque

Abre por cima da fila. Seis botões grandes, nada mais:

`Comprou` · `Vai comprar` · `Não atendeu` · `Adiar` · `Sem necessidade` · `Perdi p/ concorrente`

- `Comprou` → abre campo numérico com o **valor sugerido já preenchido**. Confirma e fecha.
- `Adiar` → 3 atalhos: amanhã / 3 dias / 1 semana.
- `Perdi p/ concorrente` → único que abre observação, e **ainda assim opcional**. Esse
  desfecho gera alerta imediato no painel do gestor.

Fechou o sheet, o card sai da fila com animação. Sem tela de confirmação, sem "salvar".

### 6.3 Fila zerada

Tela de fechamento: `Fila zerada. 7 contatos, R$ 8.200 fechados.` Mostra o resumo do
dia e a posição do vendedor na semana. É o único momento de gamificação do MVP.

### 6.4 Cliente 360 — `/cliente/[id]`

Histórico de compras por família (gráfico de barras simples por mês), equipamentos em
comodato com data da última manutenção, últimas interações registradas, ciclo calculado
por família com o rótulo de origem (`próprio` ou `estimado pelo segmento`).

Mostrar a origem do cálculo é o que faz o vendedor confiar no número.

### 6.5 Painel do gestor — `/painel` (desktop)

Quatro blocos, nada além:

1. **Fila concluída por vendedor** (hoje e média de 7 dias) — a métrica de adesão.
2. **Conversão do sinal** — % de sinais que viraram `comprou`, por tipo de sinal.
3. **Alertas críticos** — equipamentos ociosos e "perdi p/ concorrente" da semana.
4. **Sinais não trabalhados** — o que está envelhecendo na fila e de quem.

### 6.6 Modo ritual — `/painel/ritual`

Layout de tela cheia para projetar na reunião de 10 minutos: fonte grande, um vendedor
por linha, fila de ontem e de hoje. Custa pouco e é o que faz o item 8 acontecer.

---

## 7. Requisitos de PWA

| Item | Especificação |
|---|---|
| `manifest.json` | `display: standalone`, ícones 192/512, `start_url: /fila` |
| Service worker | Serwist; `NetworkFirst` nas APIs, `CacheFirst` nos assets |
| Offline (leitura) | a fila do dia é cacheada no `IndexedDB` ao abrir |
| Offline (escrita) | registros vão para fila local e sincronizam ao voltar a rede |
| Push | Web Push (VAPID). Um disparo, 07:30: `Sua fila de hoje: 7 contatos, R$ 12.400` |
| Instalação | banner customizado após o 2º acesso; no iOS, instrução ilustrada |

**Offline não é opcional.** Vendedor em rota tem sinal ruim; se o registro falhar uma
vez, ele para de registrar para sempre.

Cada registro offline recebe um `uuid` gerado no cliente, e o endpoint de sync é
idempotente por esse `uuid`. Sem isso, uma reconexão dupla gera pedido duplicado.

---

## 8. Processo e ritual (a parte que não é software)

Sem isto, o sistema não é usado. Vale escrever no escopo do contrato como
**responsabilidade do cliente**, não do fornecedor.

### Semana 0 — antes de qualquer linha de código em produção

1. **Inventário do comodato.** Levantar qual equipamento está em qual cliente, desde
   quando e com que número de série. Se estiver incompleto (e normalmente está), isso
   é escopo de trabalho e um argumento de venda por si só.
2. **Limpeza de cadastro.** Clientes duplicados, produtos sem família e unidade de
   medida inconsistente inutilizam o cálculo de ciclo. Reserve 20–30% do esforço aqui.
3. **Definir o segmento de cada cliente.** É o fallback do motor para cliente novo.

### Ritual diário — 10 minutos, todo dia, mesma hora

O supervisor abre `/painel/ritual`. Cada vendedor diz: fila de ontem, o que fechou, o
que travou. Não é cobrança de meta — é leitura da fila em voz alta.

**Este é o gatilho real do sistema.** A notificação push é um lembrete; a reunião é o
que faz acontecer.

### Regra de decisão do piloto

Combinada com o cliente **antes** de começar, por escrito:

> Se a taxa de fila concluída ficar abaixo de **60% por duas semanas seguidas**, o canal
> é o problema, e a Fase 2 passa a incluir integração com WhatsApp oficial.

Isso transforma a discussão sobre canal em decisão por dado, não em opinião.

### Piloto

2 a 3 vendedores, 60 dias, o resto da equipe como grupo de controle. Comparar:
conversão do sinal em pedido, intervalo médio de recompra e receita por cliente ativo.

---

## 9. Roadmap — 6 sprints de 1 semana

| Sprint | Entrega | Aceite |
|---|---|---|
| 1 | Repo, schema, Prisma, `MockErpClient`, job de sync | `select count(*) from nota` bate com o JSON |
| 2 | Motor de sinais + testes contra os cenários plantados | atinge as metas do item 5.5 |
| 3 | Auth, `/fila`, card, bottom sheet de registro | vendedor registra 10 sinais em < 2 min |
| 4 | PWA: manifest, SW, offline, push, tela de fila zerada | funciona em modo avião e sincroniza depois |
| 5 | `/cliente/[id]`, `/painel`, `/painel/ritual` | gestor identifica o pior vendedor em < 10s |
| 6 | Carga de dados reais, treinamento, ajuste de LEAD_TIME | 2 vendedores usando em produção |

Fase 0 (descoberta técnica do ERP, 3–5 dias) roda **em paralelo ao sprint 1** e é
cobrada à parte. Não precifique o projeto inteiro antes de fechar a Fase 0.

---

## 10. Fora do escopo do MVP

Escreva isso na proposta. Escopo negativo é o que protege prazo e margem.

- Escrita de volta no ERP (pedido gerado automaticamente) → Fase 3
- WhatsApp, oficial ou não → Fase 2, condicionado à regra do item 8
- App nativo iOS/Android
- Integração com ALVO e Rota Exata → Fase 2
- Multiempresa / multi-filial
- Machine learning. **A mediana resolve.** Modelo preditivo aqui é custo sem ganho e
  ainda tira a explicabilidade que faz o vendedor confiar no alerta.
- Biblioteca de vídeos de autoatendimento técnico → Fase 2
- Metas, comissão e ranking além da tela de fila zerada

---

## 11. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| API do ERP só de leitura ou sem endpoint de notas | alto | resolver na Fase 0, antes do preço |
| Cadastro de comodato inexistente | alto | vira escopo próprio; adiar `equip_ocioso` |
| Cadastro sujo (duplicados, sem família) | médio | semana 0 de limpeza, com o cliente |
| Vendedor não abre o app | **crítico** | ritual diário + push + regra dos 60% |
| Gestor não olha o painel | **crítico** | ritual como responsabilidade contratual |
| LGPD: dados de cliente fora do ERP | médio | base no servidor do cliente, log de acesso |

---

## Anexos entregues

- `gerar_mock_erp.py` — gerador de dados simulados do ERP (seed fixo, reprodutível)
- `validar.py` — roda o motor de sinais no mock e mede a detecção dos cenários
- `mock_erp/*.json` — os dados já gerados, prontos para uso
