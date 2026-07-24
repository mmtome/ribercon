"""Sanity check: roda o motor de sinais em cima do mock e ve se acha os cenarios plantados."""
import json, statistics
from datetime import date, datetime
from collections import defaultdict

HOJE = date(2026, 7, 23)
LEAD = 5
P = "mock_erp/"
clientes = {c["id"]: c for c in json.load(open(P+"clientes.json"))}
notas = json.load(open(P+"notas.json"))
equips = json.load(open(P+"equipamentos.json"))

# compras[(cliente, familia)] = [datas]
compras = defaultdict(list)
valor = defaultdict(list)
for n in notas:
    d = datetime.fromisoformat(n["data_emissao"]).date()
    for it in n["itens"]:
        compras[(n["cliente_id"], it["familia_id"])].append(d)
        valor[(n["cliente_id"], it["familia_id"])].append(it["valor_total"])

# mediana do intervalo por segmento (fallback)
por_seg = defaultdict(list)
ciclos = {}
for (cli, fam), datas in compras.items():
    datas = sorted(datas)
    if len(datas) >= 3:
        ints = [(datas[i+1]-datas[i]).days for i in range(len(datas)-1)]
        m = statistics.median(ints)
        ciclos[(cli, fam)] = m
        por_seg[(clientes[cli]["segmento"], fam)].append(m)
seg_med = {k: statistics.median(v) for k, v in por_seg.items()}

achados = defaultdict(set)
for (cli, fam), datas in compras.items():
    ultima = max(datas)
    ciclo = ciclos.get((cli, fam)) or seg_med.get((clientes[cli]["segmento"], fam))
    if not ciclo: continue
    dias = (HOJE - ultima).days
    prev = ciclo - LEAD
    if len(datas) < 3:
        achados["sem_ciclo"].add(cli)
    elif dias > ciclo * 3:
        achados["perdido"].add(cli)
    elif dias > ciclo * 1.15:
        achados["atrasado"].add(cli)
    elif dias >= prev:
        achados["em_janela"].add(cli)

# equipamento ocioso: dispenser ativo + familia do refil parada ha > 2.5x o ciclo
for e in equips:
    fam = e["familia_consumivel_id"]; cli = e["cliente_id"]
    datas = compras.get((cli, fam))
    ciclo = ciclos.get((cli, fam)) or seg_med.get((clientes[cli]["segmento"], fam))
    if not datas or not ciclo: continue
    if (HOJE - max(datas)).days > ciclo * 2.5:
        achados["equip_ocioso"].add(cli)

print("\n--- o motor achou (vs cenario plantado) ---")
for tipo, ids in sorted(achados.items()):
    alias = {"sem_ciclo": "novo"}.get(tipo, tipo)
    reais = sum(1 for i in ids if clientes[i]["_cenario"] == alias)
    print(f"{tipo:<14} detectados={len(ids):<4} bateram com o rotulo={reais}")
