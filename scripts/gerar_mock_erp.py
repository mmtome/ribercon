"""
Gerador de dados simulados do ERP — MVP Ciclo
Gera JSONs que imitam o que a API do ERP RP vai devolver depois.
Uso: python gerar_mock_erp.py
"""

import json
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(42)  # reprodutivel: rodar de novo gera exatamente os mesmos dados

HOJE = date(2026, 7, 23)
MESES_HISTORICO = 20
OUT = Path("mock_erp")
OUT.mkdir(exist_ok=True)

# --------------------------------------------------------------------------
# Catalogo
# --------------------------------------------------------------------------

FAMILIAS = [
    {"id": "FAM01", "nome": "Refil sabonete espuma", "consumivel_de": "dispenser_sabonete"},
    {"id": "FAM02", "nome": "Papel toalha interfolha", "consumivel_de": "dispenser_papel_toalha"},
    {"id": "FAM03", "nome": "Papel higienico rolao", "consumivel_de": "dispenser_papel_higienico"},
    {"id": "FAM04", "nome": "Alcool gel", "consumivel_de": "dispenser_alcool"},
    {"id": "FAM05", "nome": "Detergente concentrado", "consumivel_de": None},
    {"id": "FAM06", "nome": "Desinfetante concentrado", "consumivel_de": None},
    {"id": "FAM07", "nome": "Saco de lixo", "consumivel_de": None},
]

PRODUTOS = [
    ("PRD001", "Refil sabonete espuma neutro 800ml", "FAM01", 28.90, "UN"),
    ("PRD002", "Refil sabonete espuma antisseptico 800ml", "FAM01", 34.50, "UN"),
    ("PRD003", "Papel toalha interfolha 2 dobras cx 1000fl", "FAM02", 89.90, "CX"),
    ("PRD004", "Papel toalha interfolha luxo cx 1000fl", "FAM02", 112.00, "CX"),
    ("PRD005", "Papel higienico rolao 300m fardo 8un", "FAM03", 96.00, "FD"),
    ("PRD006", "Papel higienico rolao 500m fardo 8un", "FAM03", 148.00, "FD"),
    ("PRD007", "Alcool gel 70% refil 800ml", "FAM04", 22.40, "UN"),
    ("PRD008", "Detergente concentrado 5L", "FAM05", 68.00, "GL"),
    ("PRD009", "Desinfetante concentrado 5L", "FAM06", 54.00, "GL"),
    ("PRD010", "Saco lixo 100L reforcado pct 100un", "FAM07", 78.00, "PCT"),
]

# ciclo base em dias por segmento (quanto menor, mais rapido o cliente recompra)
SEGMENTOS = {
    "Hospital":     {"ciclo": 18, "porte": 3.0},
    "Lavanderia":   {"ciclo": 22, "porte": 1.8},
    "Supermercado": {"ciclo": 25, "porte": 2.2},
    "Restaurante":  {"ciclo": 32, "porte": 1.0},
    "Academia":     {"ciclo": 35, "porte": 0.9},
    "Escola":       {"ciclo": 45, "porte": 1.6},
    "Clinica":      {"ciclo": 68, "porte": 0.6},
    "Escritorio":   {"ciclo": 80, "porte": 0.5},
}

# multiplicador do ciclo por familia (papel higienico dura mais que sabonete, etc)
MULT_FAMILIA = {
    "FAM01": 1.0, "FAM02": 0.85, "FAM03": 1.15,
    "FAM04": 1.3, "FAM05": 1.5, "FAM06": 1.5, "FAM07": 0.9,
}

TIPOS_EQUIPAMENTO = {
    "dispenser_sabonete": "FAM01",
    "dispenser_papel_toalha": "FAM02",
    "dispenser_papel_higienico": "FAM03",
    "dispenser_alcool": "FAM04",
}

VENDEDORES = [
    {"id": "V01", "nome": "Vendedor 1", "ativo": True},
    {"id": "V02", "nome": "Vendedor 2", "ativo": True},
    {"id": "V03", "nome": "Vendedor 3", "ativo": True},
    {"id": "V04", "nome": "Vendedor 4", "ativo": True},
]

CIDADES = [
    ("Uberaba", "MG"), ("Uberlandia", "MG"), ("Araxa", "MG"),
    ("Ribeirao Preto", "SP"), ("Franca", "SP"), ("Barretos", "SP"),
]

PREFIXOS = ["Sao", "Santa", "Nova", "Bom", "Grande", "Alto", "Vale", "Central", "Real", "Prime"]
NUCLEOS = ["Vida", "Saude", "Sabor", "Limpo", "Norte", "Sul", "Horizonte", "Aurora", "Estrela", "Campo",
           "Progresso", "Uniao", "Cristal", "Atlas", "Fortaleza", "Jardim", "Aliança", "Vertice"]


# --------------------------------------------------------------------------
# Cenarios injetados de proposito (é o que o motor de sinais tem que detectar)
# --------------------------------------------------------------------------
# normal            -> comprando no ritmo
# em_janela         -> proxima compra prevista nos proximos 7 dias
# atrasado          -> ja passou da janela, ninguem ligou
# equip_ocioso      -> tem dispenser em comodato mas parou de comprar o refil (suspeita de concorrente)
# em_queda          -> intervalos crescendo, cliente esfriando
# novo              -> menos de 3 compras, sem ciclo calculavel
# perdido           -> sumiu ha muito tempo

DISTRIBUICAO = (
    ["normal"] * 34 + ["em_janela"] * 16 + ["atrasado"] * 14 +
    ["equip_ocioso"] * 8 + ["em_queda"] * 9 + ["novo"] * 11 + ["perdido"] * 8
)

N_CLIENTES = 120


def gerar_cnpj(i: int) -> str:
    return f"{10 + i:02d}.{random.randint(100,999)}.{random.randint(100,999)}/0001-{random.randint(10,99)}"


def nome_empresa(seg: str) -> str:
    base = f"{random.choice(PREFIXOS)} {random.choice(NUCLEOS)}"
    sufixo = {
        "Hospital": "Hospital", "Lavanderia": "Lavanderia", "Supermercado": "Supermercado",
        "Restaurante": "Restaurante", "Academia": "Academia", "Escola": "Colegio",
        "Clinica": "Clinica", "Escritorio": "Servicos",
    }[seg]
    return f"{sufixo} {base}"


def montar_clientes():
    clientes = []
    cenarios = DISTRIBUICAO[:]
    random.shuffle(cenarios)
    for i in range(N_CLIENTES):
        seg = random.choice(list(SEGMENTOS.keys()))
        cidade, uf = random.choice(CIDADES)
        cenario = cenarios[i % len(cenarios)]
        # cadastro: cliente "novo" entrou ha pouco tempo
        if cenario == "novo":
            dias_cadastro = random.randint(35, 110)
        else:
            dias_cadastro = random.randint(MESES_HISTORICO * 30, MESES_HISTORICO * 30 + 400)
        clientes.append({
            "id": f"CLI{i+1:04d}",
            "cnpj": gerar_cnpj(i),
            "razao_social": nome_empresa(seg) + " LTDA",
            "nome_fantasia": nome_empresa(seg),
            "segmento": seg,
            "cidade": cidade,
            "uf": uf,
            "vendedor_id": random.choice(VENDEDORES)["id"],
            "data_cadastro": (HOJE - timedelta(days=dias_cadastro)).isoformat(),
            "ativo": True,
            "_cenario": cenario,  # campo de debug: o ERP real NAO tem isso
        })
    return clientes


def familias_do_cliente(seg: str) -> list:
    """Quais familias esse cliente costuma comprar."""
    base = ["FAM01", "FAM02", "FAM03"]
    extras = ["FAM04", "FAM05", "FAM06", "FAM07"]
    n_extra = {"Hospital": 4, "Supermercado": 3, "Restaurante": 3, "Lavanderia": 2}.get(seg, 1)
    return base + random.sample(extras, min(n_extra, len(extras)))


def gerar_historico(cliente):
    """Gera as datas de compra por familia, aplicando o cenario do cliente."""
    seg = SEGMENTOS[cliente["segmento"]]
    cenario = cliente["_cenario"]
    fams = familias_do_cliente(cliente["segmento"])
    compras = []  # (data, familia_id)

    for fam in fams:
        ciclo = seg["ciclo"] * MULT_FAMILIA[fam] * random.uniform(0.85, 1.15)

        if cenario == "novo":
            n_compras = random.randint(1, 2)
            d = HOJE - timedelta(days=random.randint(20, 90))
            for _ in range(n_compras):
                compras.append((d, fam))
                d = d + timedelta(days=int(ciclo))
            continue

        # constroi de tras pra frente a partir da ultima compra
        if cenario == "em_janela":
            ultima = HOJE - timedelta(days=int(ciclo * random.uniform(0.80, 0.97)))
        elif cenario == "atrasado":
            ultima = HOJE - timedelta(days=int(ciclo * random.uniform(1.20, 1.70)))
        elif cenario == "perdido":
            ultima = HOJE - timedelta(days=int(ciclo * random.uniform(4.0, 7.0)))
        elif cenario == "equip_ocioso":
            # so a familia do dispenser parou; o resto segue normal
            if fam in ("FAM01", "FAM02"):
                ultima = HOJE - timedelta(days=int(ciclo * random.uniform(3.5, 6.0)))
            else:
                ultima = HOJE - timedelta(days=int(ciclo * random.uniform(0.3, 1.0)))
        else:  # normal, em_queda
            ultima = HOJE - timedelta(days=int(ciclo * random.uniform(0.1, 0.95)))

        d = ultima
        i = 0
        while d > HOJE - timedelta(days=MESES_HISTORICO * 30):
            compras.append((d, fam))
            # cliente em queda: intervalos vao aumentando conforme volta no tempo eles diminuem
            if cenario == "em_queda":
                fator = 1.0 - min(0.45, i * 0.09)
            else:
                fator = 1.0
            intervalo = ciclo * fator * random.uniform(0.85, 1.15)
            d = d - timedelta(days=max(7, int(intervalo)))
            i += 1

    return sorted(compras, key=lambda x: x[0])


def montar_notas(clientes):
    notas = []
    prod_por_fam = {}
    for sku, desc, fam, preco, un in PRODUTOS:
        prod_por_fam.setdefault(fam, []).append((sku, preco))

    numero = 100000
    for cli in clientes:
        porte = SEGMENTOS[cli["segmento"]]["porte"]
        compras = gerar_historico(cli)

        # consolida compras proximas (janela de 7 dias) numa nota so:
        # na vida real o cliente faz UM pedido com varias familias juntas
        por_data = {}
        ancora = None
        for data, fam in compras:
            if ancora is None or (data - ancora).days > 7:
                ancora = data
            por_data.setdefault(ancora, []).append(fam)

        for data, fams in sorted(por_data.items()):
            itens = []
            for fam in set(fams):
                sku, preco = random.choice(prod_por_fam[fam])
                qtd = max(1, int(random.uniform(2, 8) * porte))
                itens.append({
                    "produto_id": sku,
                    "familia_id": fam,
                    "quantidade": qtd,
                    "valor_unitario": preco,
                    "valor_total": round(qtd * preco, 2),
                })
            numero += 1
            notas.append({
                "id": f"NF{numero}",
                "numero": str(numero),
                "cliente_id": cli["id"],
                "data_emissao": data.isoformat(),
                "valor_total": round(sum(i["valor_total"] for i in itens), 2),
                "itens": itens,
            })
    return notas


def montar_equipamentos(clientes, notas):
    """Equipamentos em comodato. Todo cliente com dispenser tem que consumir o refil."""
    equipamentos = []
    n = 0
    for cli in clientes:
        if cli["_cenario"] == "novo" and random.random() < 0.5:
            continue
        tipos = random.sample(list(TIPOS_EQUIPAMENTO.keys()), random.randint(1, 3))
        # garante que quem foi marcado como equip_ocioso tenha o dispenser parado
        if cli["_cenario"] == "equip_ocioso" and "dispenser_sabonete" not in tipos:
            tipos.append("dispenser_sabonete")
        for tipo in tipos:
            n += 1
            qtd = max(1, int(SEGMENTOS[cli["segmento"]]["porte"] * random.uniform(1, 3)))
            instalacao = HOJE - timedelta(days=random.randint(120, 900))
            ult_manut = instalacao + timedelta(days=random.randint(30, max(31, (HOJE - instalacao).days)))
            equipamentos.append({
                "id": f"EQP{n:04d}",
                "cliente_id": cli["id"],
                "tipo": tipo,
                "familia_consumivel_id": TIPOS_EQUIPAMENTO[tipo],
                "numero_serie": f"SN{random.randint(100000, 999999)}",
                "quantidade": qtd,
                "data_instalacao": instalacao.isoformat(),
                "ultima_manutencao": ult_manut.isoformat(),
                "intervalo_preventivo_dias": 180,
                "status": "ativo",
            })
    return equipamentos


def main():
    clientes = montar_clientes()
    notas = montar_notas(clientes)
    equipamentos = montar_equipamentos(clientes, notas)

    produtos = [
        {"id": sku, "descricao": desc, "familia_id": fam, "preco_tabela": preco, "unidade": un}
        for sku, desc, fam, preco, un in PRODUTOS
    ]

    arquivos = {
        "clientes.json": clientes,
        "produtos.json": produtos,
        "familias.json": FAMILIAS,
        "vendedores.json": VENDEDORES,
        "notas.json": notas,
        "equipamentos.json": equipamentos,
    }
    for nome, dados in arquivos.items():
        (OUT / nome).write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")

    # relatorio
    from collections import Counter
    cen = Counter(c["_cenario"] for c in clientes)
    print(f"Data de referencia: {HOJE}")
    print(f"clientes:     {len(clientes)}")
    print(f"notas:        {len(notas)}")
    print(f"itens:        {sum(len(n['itens']) for n in notas)}")
    print(f"equipamentos: {len(equipamentos)}")
    print(f"faturamento simulado: R$ {sum(n['valor_total'] for n in notas):,.2f}")
    print("\ncenarios plantados (o motor tem que achar isso):")
    for k, v in cen.most_common():
        print(f"  {k:<14} {v}")


if __name__ == "__main__":
    main()
