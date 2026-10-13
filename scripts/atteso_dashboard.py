# Calcolo indipendente degli attesi di SCENARI_DASHBOARD (src/core/__tests__/scenari.ts).
# Non usa il motore: se il motore e questo script danno lo stesso risultato, il test e' significativo.
# Uso: python scripts/atteso_dashboard.py
# Calcolo INDIPENDENTE (non usa il motore) degli scenari dashboard, con arrotondamento come Math.round.
import math, json
def R(x): return math.floor(x + 0.5)
def pct(c, r): return R(c * r)
QA_OVER40 = 196156 + 9554
QA_35_40 = 106212 + 9554
S_U40, S_O40, MASS = 544677, 1005928, 15000000

def irpef(imp):
    tot = 0; prev = 0
    for lim, al in [(2800000, .23), (5000000, .33), (None, .43)]:
        L = lim if lim is not None else float('inf')
        base = max(0, min(imp, L) - prev); tot += R(base * al)
        if imp <= L: break
        prev = L
    return tot
def detr(r):
    if r <= 0: return 0
    if r <= 550000: return 126500
    if r <= 2800000: return R(50000 + 76500 * (2800000 - r) / (2800000 - 550000))
    if r <= 5000000: return R(50000 * (5000000 - r) / (5000000 - 2800000))
    return 0
def ordinario_tot(compensi, spese_ded, contributi):
    reddito = compensi - spese_ded; rc = max(0, reddito)
    imp = max(0, rc - min(contributi, rc)); lorda = irpef(imp)
    netta = lorda - min(detr(rc), lorda)
    reg = R(imp * 0.0123) if netta > 0 else 0
    return netta + reg
def qb(reddito, soglia_annua, f=1.0):
    s = R(soglia_annua * f); m = R(MASS * f)
    if reddito <= s: return 0
    return pct(max(0, min(reddito, m) - s), 0.195) + pct(max(0, reddito - m), 0.01)
out = {}

# D1 forfettario 30/6, over 40, 15%
f = 181/365; ricavi = 4500000
qbprec = qb(6240000, S_O40)
V = R(ricavi / f); contr = QA_OVER40 + qbprec
imposta_annua = pct(max(0, pct(V, .78) - min(contr, pct(V, .78))), .15)
mat = R(imposta_annua * f); qbm = qb(pct(ricavi, .78), S_O40, f)
out['D1'] = dict(imposteMaturate=mat, imposte=mat, quotaAResidua=0, quotaBMaturata=qbm, iva=0,
  daAccantonare=mat + qbm, impegni=200000 + qbprec, guadagnoNetto=ricavi - mat - qbm - R(QA_OVER40 * f))

# D2 ordinario 30/9 con ritenute
f = 273/365; ricavi = 5400000; spese = [80000]*9; rit = 9*120000
V = R(ricavi / f); speseP = sum(R(s / f) for s in spese)
tot = ordinario_tot(V, speseP, QA_OVER40)
mat = R(tot * f); imposte = max(0, mat - rit)
qbm = qb(ricavi - sum(spese), S_O40, f)
out['D2'] = dict(imposteMaturate=mat, imposte=imposte, quotaAResidua=0, quotaBMaturata=qbm, iva=0,
  daAccantonare=imposte + qbm, impegni=None, guadagnoNetto=ricavi - sum(spese) - mat - qbm - R(QA_OVER40 * f))

# D3 forfettario 15/12, 5%, versamenti senza riferimento
f = 349/365; ricavi = 12*500000
qbprec = qb(3900000, S_U40)
contr = QA_35_40 + qbprec
V = R(ricavi / f); rl = pct(V, .78)
imposta_annua = pct(max(0, rl - min(contr, rl)), .05)
mat = R(imposta_annua * f); acconti = 200000; imposte = max(0, mat - acconti)
qbm = qb(pct(ricavi, .78), S_U40, f)
out['D3'] = dict(imposteMaturate=mat, imposte=imposte, quotaAResidua=0, quotaBMaturata=qbm, iva=0,
  daAccantonare=imposte + qbm, impegni=0, guadagnoNetto=ricavi - mat - qbm - R(QA_35_40 * f), quotaBPrec=qbprec)

# D4 ordinario 30/6 con IVA 22%
f = 181/365; ricavi = 3000000
iva = 264000 + pct(264000, .01)
V = R(ricavi / f); tot = ordinario_tot(V, 0, QA_OVER40)
mat = R(tot * f); qbm = qb(ricavi, S_O40, f)
out['D4'] = dict(imposteMaturate=mat, imposte=mat, quotaAResidua=QA_OVER40, quotaBMaturata=qbm, iva=iva,
  daAccantonare=mat + QA_OVER40 + qbm + iva, impegni=None, guadagnoNetto=ricavi - mat - qbm - R(QA_OVER40 * f))

# D5 forfettario 20/2: aliquota effettiva dell'anno scorso
f = 51/365; ricavi = 1300000
mat = pct(ricavi, 900000 / 8000000); qbm = qb(pct(ricavi, .78), S_O40, f)
qbprec = qb(6240000, S_O40)
out['D5'] = dict(imposteMaturate=mat, imposte=mat, quotaAResidua=QA_OVER40, quotaBMaturata=qbm, iva=0,
  daAccantonare=mat + QA_OVER40 + qbm, impegni=200000 + qbprec, guadagnoNetto=ricavi - mat - qbm - R(QA_OVER40 * f))
print(json.dumps(out, indent=1))
