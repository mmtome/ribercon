/**
 * Teste de regressão do motor de sinais.
 *
 * Roda contra os dados simulados e mede se o motor encontra os cenários que o
 * gerador plantou de propósito. O seed do gerador é fixo, então o resultado é
 * comparável entre execuções: se você mexer nas regras e o número cair, quebrou.
 *
 * Rodar:  npm run testar:motor
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { calcularCiclos } from '../src/lib/motor/ciclo';
import { gerarSinais, montarFila } from '../src/lib/motor/sinais';

const HOJE = new Date('2026-07-23T00:00:00Z');
const DIR = join(process.cwd(), 'mock_erp');

const ler = async (f: string) => JSON.parse(await readFile(join(DIR, f), 'utf-8'));

// metas do item 5.5 da especificação
const METAS: Record<string, number> = {
  atrasado: 1.0,
  em_janela: 0.9,
  equip_ocioso: 1.0,
  novo: 1.0,
};

// cenário plantado -> tipos de sinal que satisfazem
const ACEITA: Record<string, string[]> = {
  atrasado: ['atrasado'],
  em_janela: ['recompra'],
  equip_ocioso: ['equip_ocioso'],
  novo: ['cadencia'],
  em_queda: ['queda', 'atrasado', 'recompra'],
  perdido: ['recuperacao'],
};

async function main() {
  const clientes = await ler('clientes.json');
  const notas = await ler('notas.json');
  const equipamentos = await ler('equipamentos.json');

  const t0 = Date.now();
  const ciclos = calcularCiclos(clientes, notas);
  const sinais = gerarSinais(clientes, ciclos, equipamentos, HOJE);
  const ms = Date.now() - t0;

  console.log(`\nclientes ${clientes.length} · notas ${notas.length} · ciclos ${ciclos.length} · sinais ${sinais.length}`);
  console.log(`motor rodou em ${ms}ms\n`);

  const proprio = ciclos.filter((c) => c.origem === 'proprio').length;
  console.log(`ciclo calculado com histórico próprio: ${proprio}/${ciclos.length} (${Math.round(proprio / ciclos.length * 100)}%)\n`);

  // ---- detecção por cenário ----
  const porCliente = new Map<string, Set<string>>();
  for (const s of sinais) {
    if (!porCliente.has(s.cliente_id)) porCliente.set(s.cliente_id, new Set());
    porCliente.get(s.cliente_id)!.add(s.tipo);
  }

  console.log('cenário plantado    plantados  detectados   taxa   meta');
  console.log('─'.repeat(58));
  let falhou = false;
  for (const [cenario, tipos] of Object.entries(ACEITA)) {
    const alvo = clientes.filter((c: any) => c._cenario === cenario);
    const ok = alvo.filter((c: any) => {
      const t = porCliente.get(c.id);
      return t && tipos.some((x) => t.has(x));
    });
    const taxa = alvo.length ? ok.length / alvo.length : 1;
    const meta = METAS[cenario];
    const status = meta === undefined ? '  —  ' : (taxa >= meta ? ' OK  ' : 'FALHA');
    if (meta !== undefined && taxa < meta) falhou = true;
    console.log(
      `${cenario.padEnd(18)} ${String(alvo.length).padStart(6)}  ${String(ok.length).padStart(9)}  ` +
      `${(taxa * 100).toFixed(0).padStart(4)}%  ${status}`,
    );
  }

  // ---- ruído: cliente "normal" não pode entupir a fila ----
  const normais = clientes.filter((c: any) => c._cenario === 'normal');
  const normaisComSinal = normais.filter((c: any) => porCliente.has(c.id));
  console.log(`\nruído: ${normaisComSinal.length}/${normais.length} clientes "normal" geraram algum sinal`);
  console.log('(esperado: parte deles entra mesmo — o sinal é por família, e um cliente');
  console.log(' saudável pode ter uma família na janela. Acima de ~70% vira ruído.)');

  // ---- fila por vendedor ----
  console.log('\nfila do dia:');
  for (const v of await ler('vendedores.json')) {
    const fila = montarFila(sinais, v.id);
    const valor = fila.reduce((s, c) => s + c.principal.valor_esperado, 0);
    const criticos = fila.filter((c) => c.principal.tipo === 'equip_ocioso').length;
    console.log(
      `  ${v.id}  ${String(fila.length).padStart(2)} cards · ` +
      `R$ ${valor.toFixed(2).padStart(9)} em jogo · ${criticos} crítico(s)`,
    );
  }

  // ---- exemplo de card, como chega na tela ----
  const exemplo = montarFila(sinais, 'V01')[0];
  if (exemplo) {
    const cli = clientes.find((c: any) => c.id === exemplo.cliente_id);
    console.log(`\nexemplo de card (topo da fila do V01):`);
    console.log(`  ${cli.nome_fantasia} — ${cli.segmento} — ${cli.cidade}/${cli.uf}`);
    console.log(`  tipo: ${exemplo.principal.tipo} · score ${exemplo.principal.score}`);
    console.log(`  motivo:`, JSON.stringify(exemplo.principal.motivo));
    console.log(`  + ${exemplo.secundarios.length} sinal(is) secundário(s) no mesmo card`);
  }

  console.log(falhou ? '\nRESULTADO: FALHOU — alguma meta do item 5.5 não bateu\n' : '\nRESULTADO: OK\n');
  process.exit(falhou ? 1 : 0);

}

main();
