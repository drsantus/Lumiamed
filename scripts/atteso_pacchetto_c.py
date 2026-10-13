# Calcolo INDIPENDENTE (non usa il motore) degli attesi sulle date dei test del Pacchetto C:
# 4 ottobre festivo dal 2026, slittamento delle scadenze fiscali, scadenze ENPAM senza slittamento,
# finestra dello scadenziario sui 12 mesi mobili.
# Uso: python scripts/atteso_pacchetto_c.py
import calendar, json
from datetime import date, timedelta

def pasqua(y):  # Meeus/Jones/Butcher
    a = y % 19; b = y // 100; c = y % 100; d = b // 4; e = b % 4; f = (b + 8) // 25; g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30; i = c // 4; k = c % 4; l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451; mese = (h + l - 7 * m + 114) // 31; giorno = (h + l - 7 * m + 114) % 31 + 1
    return date(y, mese, giorno)

def festivi(y):
    fissi = [(1, 1), (1, 6), (4, 25), (5, 1), (6, 2), (8, 15), (11, 1), (12, 8), (12, 25), (12, 26)]
    if y >= 2026: fissi.append((10, 4))
    return {date(y, m, d) for m, d in fissi} | {pasqua(y) + timedelta(days=1)}

def lavorativo(d): return d.weekday() < 5 and d not in festivi(d.year)
def slitta(d):
    while not lavorativo(d): d += timedelta(days=1)
    return d
def fine_mese(y, m): return date(y, m, calendar.monthrange(y, m)[1])

out = {}
out['4_ottobre'] = {str(y): {'giorno': date(y, 10, 4).strftime('%A'), 'lavorativo': lavorativo(date(y, 10, 4)), 'slitta_a': str(slitta(date(y, 10, 4)))}
                    for y in (2024, 2026, 2027, 2028)}
out['dichiarazione_2026'] = str(slitta(date(2026, 10, 31)))
out['quotaB_31_10_2026'] = {'giorno': date(2026, 10, 31).strftime('%A'), 'enpam_senza_slittamento': '2026-10-31'}

# Finestra di 12 mesi da oggi 15/12/2026: forfettario, Quota A e B in 1 e 9 rate, nessuna IVA, niente fatture elettroniche.
# Date standard 2027 (parametri provvisori); 2026 con le date dei parametri (2° acconto 30/11, dichiarazione 31/10).
oggi = date(2026, 12, 15); fine = date(2027, 12, 15)
def scadenziario(y, standard):
    s = []
    fisc = lambda i, d: s.append((i, y, slitta(d)))
    enpam = lambda i, d: s.append((i, y, d))
    fisc('sts', date(y, 1, 31))
    enpam('quotaA-1', fine_mese(y, 4))
    enpam('modelloD', date(y, 7, 31))
    rate_b = [(0, 10), (0, 11), (0, 12), (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6)]
    for i, (rel, m) in enumerate(rate_b):
        if rel == 1: enpam(f'quotaB-prec-{i + 1}', fine_mese(y, m))
    for i, (rel, m) in enumerate(rate_b):
        if rel == 0: enpam(f'quotaB-{i + 1}', fine_mese(y, m))
    fisc('saldo-primo-acconto', date(y, 6, 30) if standard else date(y, 7, 20))
    fisc('secondo-acconto', date(y, 11, 30))
    fisc('dichiarazione', date(y, 10, 31))
    return s
tutte = scadenziario(2026, False) + scadenziario(2027, True)
finestra = sorted([x for x in tutte if oggi <= x[2] < fine], key=lambda x: (x[2], x[1], x[0]))
out['finestra_15_12_2026'] = [[i, y, str(d)] for i, y, d in finestra]
# Rate di Quota B del ciclo 2026 (500.000 centesimi in 9 rate): divisione per difetto, resto sull'ultima
base = 500000 // 9
out['rate_quotaB_500000'] = {'prime_8': base, 'ultima': 500000 - base * 8}
print(json.dumps(out, indent=1))
