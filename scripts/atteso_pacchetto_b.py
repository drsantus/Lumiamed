# Calcolo INDIPENDENTE (non usa il motore) degli attesi dei test del Pacchetto B:
# Quota A/B con gli importi ENPAM 2026, Quota B ad aliquota ridotta, altri redditi nell'ordinario,
# riepilogo di riepilogo.test.ts, import CSV dello storico, analisi.
# Arrotondamento come Math.round di JavaScript (metà verso +infinito).
# Uso: python scripts/atteso_pacchetto_b.py
import json, math

def R(x): return math.floor(x + 0.5)
def pct(c, r): return R(c * r)

# Parametri (centesimi)
QA_FASCE = [(29, 30473), (34, 59147), (39, 110992), (None, 204983)]
MAT = 8426
S26 = {'u40': 569190, 'o40': 1051195}   # soglie Quota B redditi 2026 (stima)
S25 = {'u40': 544677, 'o40': 1005928}   # soglie Quota B redditi 2025
MASS = 15000000

def eta_al(nascita, al):  # date (y, m, d)
    e = al[0] - nascita[0]
    if (al[1], al[2]) < (nascita[1], nascita[2]): e -= 1
    return e

def fine_mese_prec(anno, mese):
    if mese == 1: return (anno - 1, 12, 31)
    giorni = [31, 29 if anno % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return (anno, mese - 1, giorni[mese - 2])

def quota_a(anno, nascita):
    annui = []
    for mese in range(1, 13):
        e = eta_al(nascita, fine_mese_prec(anno, mese))
        annui.append(next(v for lim, v in QA_FASCE if lim is None or e <= lim))
    return R(sum(annui) / 12) + MAT

def quota_b(anno_reddito, reddito, nascita, soglie, f=1.0, aliquota=0.195):
    e = eta_al(nascita, (anno_reddito, 12, 31))
    s = R((soglie['u40'] if e < 40 else soglie['o40']) * f); m = R(MASS * f)
    r = max(0, reddito)
    if r <= s: return dict(soglia=s, totale=0)
    return dict(soglia=s, totale=pct(max(0, min(r, m) - s), aliquota) + pct(max(0, r - m), 0.01))

out = {}
out['A1'] = quota_a(2026, (1996, 3, 15))
out['A2'] = quota_a(2026, (1980, 6, 1))
out['B1'] = quota_b(2026, 3120000, (1991, 5, 10), S26)
out['B2'] = quota_b(2026, 16000000, (1975, 1, 1), S26)
out['B3'] = quota_b(2026, 500000, (1995, 1, 1), S26)
out['B1_ridotta'] = quota_b(2026, 3120000, (1991, 5, 10), S26, aliquota=0.0975)
out['B2_ridotta'] = quota_b(2026, 16000000, (1975, 1, 1), S26, aliquota=0.0975)

# riepilogo.test.ts › Riepilogo (dashboard): nato 10/5/1991, oggi 30/6/2026, ricavi 20.000, ENPAM versato 592,94
f = 181 / 365
qa = quota_a(2026, (1991, 5, 10))
out['riepilogo'] = dict(
    quotaA=qa, quotaAResidua=qa - 59294,
    quotaBMaturata=quota_b(2026, pct(2000000, 0.78), (1991, 5, 10), S26, f),
    quotaB2025=quota_b(2025, 2000000, (1991, 5, 10), S25)['totale'],
    quotaB2025_ridotta=quota_b(2025, 2000000, (1991, 5, 10), S25, aliquota=0.0975)['totale'],
    quotaBMaturata_ridotta=quota_b(2026, pct(2000000, 0.78), (1991, 5, 10), S26, f, aliquota=0.0975)['totale'],
    # ordinario con 60.000 € di stipendio annuo: quota maturata al 30/6
    altriRedditiDaInizioAnno=R(6000000 * f),
)

# Ordinario con altri redditi (Sardegna 1,23%, comune non impostato): imposte sul totale − imposte sul solo stipendio
def irpef(imp):
    tot = 0; prev = 0
    for lim, al in [(2800000, .23), (5000000, .33), (None, .43)]:
        L = lim if lim is not None else float('inf')
        tot += R(max(0, min(imp, L) - prev) * al)
        if imp <= L: break
        prev = L
    return tot
def detr_aut(r):
    if r <= 0: return 0
    if r <= 550000: return 126500
    if r <= 2800000: return R(50000 + 76500 * (2800000 - r) / 2250000)
    if r <= 5000000: return R(50000 * (5000000 - r) / 2200000)
    return 0
def imposte(imp, compl, autonomo):
    lorda = irpef(imp); det = min(detr_aut(compl), lorda) if autonomo else 0; netta = lorda - det
    reg = pct(imp, 0.0123) if netta > 0 else 0
    return dict(lorda=lorda, det=det, netta=netta, reg=reg)
def marginale(prof, altri):
    t = imposte(prof + altri, prof + altri, True); a = imposte(altri, altri, False)
    netta = max(0, t['netta'] - a['netta']); reg = max(0, t['reg'] - a['reg'])
    return dict(impostaLorda=max(0, t['lorda'] - a['lorda']), detrazione=t['det'], impostaNetta=netta,
                addizionaleRegionale=reg, totaleImposte=netta + reg)
out['altri_60k_30k'] = marginale(3000000, 6000000)
out['altri_20k_10k'] = marginale(1000000, 2000000)

# Import CSV dello storico (testo in storico.test.ts): righe valide
csv_incassi = [15000, 123456, 8000]          # 150,00 / 1.234,56 / 80
csv_spese = [120000, 4550]                    # 1.200,00 / 45,50
out['csv'] = dict(totaleIncassi=sum(csv_incassi), totaleSpese=sum(csv_spese))

# Analisi: movimenti di analisi.test.ts
incassi = {1: [100000, 50000], 2: [200000], 3: [70000]}           # per mese, imponibili
spese = {1: [30000], 3: [10000, 5000]}                             # spese professionali per mese
serie = []
for m in range(1, 13):
    i = sum(incassi.get(m, [])); s = sum(spese.get(m, []))
    serie.append(dict(mese=m, incassi=i, spese=s, netto=i - s))
out['serie'] = serie[:4]
cat = {'affitto_studio': 30000, 'utenze': 10000, 'software': 5000}
tot = sum(cat.values())
out['categorie'] = [dict(categoria=k, importo=v, quota=v / tot) for k, v in sorted(cat.items(), key=lambda kv: -kv[1])]
# confronto: oggi 1/3/2026 (tutti gli incassi 2026 sono fino al 1/3); anno precedente: 1.000 € il 10/1/2025
# e 800 € il 3/3/2025 (dopo lo stesso giorno 1/3/2025, quindi fuori dal periodo)
tot_inc = sum(sum(v) for v in incassi.values()); tot_sp = sum(sum(v) for v in spese.values())
out['confronto'] = dict(totale=dict(incassi=tot_inc, spese=tot_sp, netto=tot_inc - tot_sp),
                        totalePrecedente=dict(incassi=100000, spese=0, netto=100000),
                        variazioneIncassi=(tot_inc - 100000) / 100000)

print(json.dumps(out, indent=1))
