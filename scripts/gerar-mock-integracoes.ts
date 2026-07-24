/**
 * Gerador de dados simulados das fontes externas — ALVO e Rota Exata.
 *
 * O diagnóstico lista três fontes ao lado do sistema: ERP RP, ALVO e Rota Exata.
 * `gerar_mock_erp.py` cuida da primeira. Este cuida das outras duas.
 *
 * Lê `mock_erp/*.json` e produz `mock_integracoes/*.json` COERENTES com eles: o
 * mesmo cliente, o mesmo vendedor, o mesmo mês de faturamento. Dado externo
 * inventado sem amarrar no ERP não testa nada — o de-para de ID é justamente o
 * que quebra em integração de verdade.
 *
 * Em TypeScript, e não em Python como o gerador do ERP, para rodar com o `tsx`
 * que o projeto já tem. Um gerador que exige runtime que ninguém instalou é um
 * gerador que ninguém roda.
 *
 * Rodar:  npm run mock:integracoes
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Cliente, Nota, Vendedor } from '../src/lib/erp/types';
import type {
  Campanha, CreditoCliente, MetaVendedor, FrequenciaVisita, Roteiro, ParadaRoteiro,
  SituacaoCredito, CanalAtendimento,
} from '../src/lib/integracoes/types';

const HOJE = new Date('2026-07-23T00:00:00Z');
const ERP = join(process.cwd(), 'mock_erp');
const OUT = join(process.cwd(), 'mock_integracoes');

/**
 * PRNG com semente fixa. O `Math.random` do JS não tem seed, e sem
 * reprodutibilidade o mock deixa de servir como teste de regressão — que é o
 * ponto inteiro dele.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(4242);
const entre = (a: number, b: number) => a + rnd() * (b - a);
const inteiro = (a: number, b: number) => Math.floor(entre(a, b + 1));
const escolher = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
const cent = (n: number) => Math.round(n * 100) / 100;

const ler = <T,>(f: string): T =>
  JSON.parse(readFileSync(join(ERP, f), 'utf-8')) as T;

type ClienteMock = Cliente & { _cenario: string };

const clientes = ler<ClienteMock[]>('clientes.json');
const vendedores = ler<Vendedor[]>('vendedores.json');
const notas = ler<Nota[]>('notas.json');

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDias = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** lat/lng aproximada do centro de cada cidade atendida */
const COORD: Record<string, [number, number]> = {
  'Uberaba': [-19.7472, -47.9381],
  'Uberlandia': [-18.9186, -48.2772],
  'Araxa': [-19.5932, -46.9407],
  'Ribeirao Preto': [-21.1775, -47.8103],
  'Franca': [-20.5386, -47.4008],
  'Barretos': [-20.5575, -48.5694],
};

// ---------------------------------------------------------------------------
// ALVO — crédito
// ---------------------------------------------------------------------------
// Regra de negócio que vale a pena simular: parte dos clientes que o ERP mostra
// como sumidos não foi perdida para concorrente — está com o crédito travado.
// São dois problemas diferentes, com soluções diferentes e donos diferentes
// (comercial x financeiro). Hoje a distribuidora não consegue separar um do
// outro, e é o cruzamento ERP × ALVO que separa.
function gerarCredito(): CreditoCliente[] {
  return clientes.map((c) => {
    const r = rnd();
    let situacao: SituacaoCredito;
    switch (c._cenario) {
      case 'perdido':
        situacao = r < 0.45 ? 'bloqueado' : r < 0.70 ? 'atencao' : 'liberado';
        break;
      case 'em_queda':
      case 'equip_ocioso':
        situacao = r < 0.10 ? 'bloqueado' : r < 0.32 ? 'atencao' : 'liberado';
        break;
      case 'novo':
        situacao = r < 0.25 ? 'atencao' : 'liberado';
        break;
      default:
        situacao = r < 0.03 ? 'bloqueado' : r < 0.14 ? 'atencao' : 'liberado';
    }

    const limite = cent(entre(4_000, 60_000));
    let saldo: number, vencidos: number, atraso: number;
    if (situacao === 'liberado') {
      saldo = cent(limite * entre(0, 0.55));
      vencidos = 0;
      atraso = 0;
    } else if (situacao === 'atencao') {
      saldo = cent(limite * entre(0.55, 0.95));
      vencidos = inteiro(1, 2);
      atraso = inteiro(5, 29);
    } else {
      saldo = cent(limite * entre(0.95, 1.6));
      vencidos = inteiro(2, 6);
      atraso = inteiro(30, 180);
    }

    return {
      cliente_id: c.id,
      situacao,
      limite,
      saldo_devedor: saldo,
      titulos_vencidos: vencidos,
      maior_atraso_dias: atraso,
    };
  });
}

// ---------------------------------------------------------------------------
// ALVO — campanhas
// ---------------------------------------------------------------------------
// Vigências escolhidas de propósito para exercitar o filtro: uma encerrada, uma
// que só começa semana que vem, e três valendo hoje. Integração que ignora
// vigência mostra desconto vencido no card e queima o vendedor na frente do
// cliente — é o tipo de erro que custa a confiança inteira na ferramenta.
const CAMPANHAS: Campanha[] = [
  {
    id: 'CMP001', nome: 'Giro Sabonete Julho', familia_id: 'FAM01',
    segmentos: [], inicio: '2026-07-06', fim: '2026-08-02', desconto_pct: 8,
    mecanica: '8% na linha de refil de sabonete a partir de 12 unidades',
  },
  {
    id: 'CMP002', nome: 'Papel Toalha Institucional', familia_id: 'FAM02',
    segmentos: ['Hospital', 'Clinica', 'Escola'],
    inicio: '2026-07-13', fim: '2026-07-31', desconto_pct: 12,
    mecanica: '12% em papel toalha para saúde e educação, mínimo 5 caixas',
  },
  {
    id: 'CMP003', nome: 'Álcool Gel Reposição', familia_id: 'FAM04',
    segmentos: [], inicio: '2026-07-20', fim: '2026-09-30', desconto_pct: 6,
    mecanica: '6% no álcool gel 70% em compra casada com dispenser',
  },
  {
    id: 'CMP004', nome: 'Higienização Junho', familia_id: 'FAM06',
    segmentos: [], inicio: '2026-06-01', fim: '2026-06-30', desconto_pct: 10,
    mecanica: 'ENCERRADA — existe no arquivo só para testar o filtro de vigência',
  },
  {
    id: 'CMP005', nome: 'Pré-Setembro Papel Higiênico', familia_id: 'FAM03',
    segmentos: [], inicio: '2026-08-03', fim: '2026-08-29', desconto_pct: 9,
    mecanica: 'NÃO INICIADA — idem, testa o outro lado do filtro',
  },
];

// ---------------------------------------------------------------------------
// ALVO — metas
// ---------------------------------------------------------------------------
// O realizado NÃO é inventado: sai das notas do mês corrente no mock_erp. Número
// de meta que não bate com o faturamento é a primeira coisa que o gestor percebe,
// e a partir daí ele não confia em mais nada da tela.
function gerarMetas(): MetaVendedor[] {
  const comp = iso(HOJE).slice(0, 7);
  const vendDoCliente = new Map(clientes.map((c) => [c.id, c.vendedor_id]));

  const fat = new Map<string, number>();
  const positivados = new Map<string, Set<string>>();
  for (const n of notas) {
    if (!n.data_emissao.startsWith(comp)) continue;
    const v = vendDoCliente.get(n.cliente_id);
    if (!v) continue;
    fat.set(v, (fat.get(v) ?? 0) + n.valor_total);
    if (!positivados.has(v)) positivados.set(v, new Set());
    positivados.get(v)!.add(n.cliente_id);
  }

  const carteira = new Map<string, number>();
  for (const c of clientes) {
    carteira.set(c.vendedor_id, (carteira.get(c.vendedor_id) ?? 0) + 1);
  }

  const diaDoMes = HOJE.getUTCDate();
  return vendedores.map((v) => {
    const realizado = cent(fat.get(v.id) ?? 0);
    const projecao = (realizado / diaDoMes) * 31;
    return {
      vendedor_id: v.id,
      competencia: comp,
      meta_faturamento: cent(projecao * entre(1.08, 1.22)),
      realizado_faturamento: realizado,
      meta_positivacao: Math.round((carteira.get(v.id) ?? 0) * entre(0.55, 0.75)),
      realizado_positivacao: positivados.get(v.id)?.size ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Rota Exata — frequência de visita e geolocalização
// ---------------------------------------------------------------------------
function gerarFrequencias(): FrequenciaVisita[] {
  return clientes.map((c) => {
    const nDias = ['Hospital', 'Supermercado', 'Lavanderia'].includes(c.segmento) ? 2 : 1;

    let dias: number[];
    let periodicidade: number;
    let canal: CanalAtendimento;

    if (['Escritorio', 'Clinica'].includes(c.segmento) && rnd() < 0.45) {
      // cliente pequeno e distante não paga a visita: atendimento por telefone
      dias = [];
      periodicidade = 0;
      canal = 'telefone';
    } else {
      const pool = [1, 2, 3, 4, 5];
      dias = [];
      while (dias.length < nDias) {
        const d = escolher(pool);
        if (!dias.includes(d)) dias.push(d);
      }
      dias.sort();
      periodicidade = escolher([1, 1, 1, 2]);
      canal = 'presencial';
    }

    const [lat, lng] = COORD[c.cidade];
    return {
      cliente_id: c.id,
      dias_semana: dias,
      periodicidade_semanas: periodicidade,
      canal,
      latitude: Math.round((lat + entre(-0.06, 0.06)) * 1e6) / 1e6,
      longitude: Math.round((lng + entre(-0.06, 0.06)) * 1e6) / 1e6,
    };
  });
}

// ---------------------------------------------------------------------------
// Rota Exata — roteiros dos próximos 14 dias
// ---------------------------------------------------------------------------
// Derivados da frequência, não sorteados: o roteiro tem que ser consequência do
// cadastro. Se for sorteio, o mock aceita qualquer regra que o motor implementar
// e para de servir como verificação.
function gerarRoteiros(frequencias: FrequenciaVisita[]): Roteiro[] {
  const freqPorCliente = new Map(frequencias.map((f) => [f.cliente_id, f]));
  const vendDoCliente = new Map(clientes.map((c) => [c.id, c.vendedor_id]));

  const saida: Roteiro[] = [];
  for (let delta = 0; delta < 14; delta++) {
    const dia = addDias(HOJE, delta);
    const dow = dia.getUTCDay() === 0 ? 7 : dia.getUTCDay(); // 1 = segunda
    if (dow > 5) continue; // não há roteiro comercial no fim de semana

    // semana relativa a hoje, para respeitar periodicidade quinzenal
    const semana = Math.floor(delta / 7);

    const porVendedor = new Map<string, string[]>();
    for (const f of frequencias) {
      if (f.canal !== 'presencial' || !f.dias_semana.includes(dow)) continue;
      if (f.periodicidade_semanas === 2 && semana % 2 !== 0) continue;
      const v = vendDoCliente.get(f.cliente_id);
      if (!v) continue;
      if (!porVendedor.has(v)) porVendedor.set(v, []);
      porVendedor.get(v)!.push(f.cliente_id);
    }

    for (const [vendedor_id, ids] of porVendedor) {
      // ordena por longitude: aproxima o comportamento de um roteirizador, que
      // agrupa por proximidade em vez de sortear
      ids.sort((a, b) => freqPorCliente.get(a)!.longitude - freqPorCliente.get(b)!.longitude);

      const paradas: ParadaRoteiro[] = [];
      let hora = 8 * 60;
      ids.forEach((cliente_id, i) => {
        const hh = (m: number) =>
          `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        paradas.push({
          cliente_id,
          sequencia: i + 1,
          janela_inicio: hh(hora),
          janela_fim: hh(hora + 45),
        });
        hora += 55;
        if (hora >= 12 * 60 && hora < 13 * 60 + 30) hora = 13 * 60 + 30; // almoço
      });

      saida.push({
        vendedor_id,
        data: iso(dia),
        paradas,
        km_previsto: Math.round(paradas.length * entre(6.5, 14) * 10) / 10,
      });
    }
  }
  return saida;
}

// ---------------------------------------------------------------------------

function main() {
  mkdirSync(OUT, { recursive: true });

  const credito = gerarCredito();
  const metas = gerarMetas();
  const frequencias = gerarFrequencias();
  const roteiros = gerarRoteiros(frequencias);

  const arquivos: Record<string, unknown> = {
    'alvo_credito.json': credito,
    'alvo_campanhas.json': CAMPANHAS,
    'alvo_metas.json': metas,
    'rota_frequencias.json': frequencias,
    'rota_roteiros.json': roteiros,
  };
  for (const [nome, dados] of Object.entries(arquivos)) {
    writeFileSync(join(OUT, nome), JSON.stringify(dados, null, 2), 'utf-8');
  }

  const hojeIso = iso(HOJE);
  const conta = (s: SituacaoCredito) => credito.filter((c) => c.situacao === s).length;
  const vigentes = CAMPANHAS.filter((c) => c.inicio <= hojeIso && hojeIso <= c.fim);
  const tel = frequencias.filter((f) => f.canal === 'telefone').length;

  console.log(`\nData de referência: ${hojeIso}`);
  console.log('\nALVO');
  console.log(`  crédito:   ${credito.length} clientes — liberado ${conta('liberado')} · ` +
    `atenção ${conta('atencao')} · bloqueado ${conta('bloqueado')}`);
  console.log(`  campanhas: ${CAMPANHAS.length} cadastradas, ${vigentes.length} vigentes hoje`);
  for (const m of metas) {
    const pct = (m.realizado_faturamento / m.meta_faturamento) * 100;
    console.log(
      `  meta ${m.vendedor_id}: R$ ${m.realizado_faturamento.toFixed(2).padStart(10)} / ` +
      `R$ ${m.meta_faturamento.toFixed(2).padStart(10)} (${pct.toFixed(0)}%) · ` +
      `positivação ${m.realizado_positivacao}/${m.meta_positivacao}`,
    );
  }
  console.log('\nRota Exata');
  console.log(`  frequências: ${frequencias.length} clientes ` +
    `(${tel} por telefone, ${frequencias.length - tel} presencial)`);
  console.log(`  roteiros:    ${roteiros.length} em 14 dias`);
  for (const r of roteiros.filter((r) => r.data === hojeIso).sort((a, b) =>
    a.vendedor_id.localeCompare(b.vendedor_id))) {
    console.log(`  hoje ${r.vendedor_id}: ${String(r.paradas.length).padStart(2)} paradas · ` +
      `${r.km_previsto} km`);
  }
  console.log();
}

main();
