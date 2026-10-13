import { describe, expect, it } from 'vitest';
import { confrontoAnnoPrecedente, doveVanno100Euro, serieMensili, spesePerCategoria } from '../analisi';
import { getParametri } from '../params';
import { calcolaRiepilogo } from '../riepilogo';
import type { Fattura, Spesa } from '../types';
import { SCENARI_DASHBOARD } from './scenari';

const p = getParametri(2026).parametri;

let n = 0;
const incasso = (dataIncasso: string, imponibile: number, extra: Partial<Fattura> = {}): Fattura => ({
  id: `a${++n}`, numero: String(n), dataFattura: dataIncasso, imponibile, trattamentoIva: 'forfettario_no_iva',
  bolloAddebitato: false, destinatario: 'paziente', elettronica: false, stato: 'incassata', dataIncasso, origine: 'manuale', ...extra,
});
const spesa = (data: string, importo: number, categoria: Spesa['categoria']): Spesa => ({ id: `s${++n}`, data, importo, categoria });

// Stessi movimenti di scripts/atteso_pacchetto_b.py (sezione "Analisi")
const fatture: Fattura[] = [
  incasso('2026-01-10', 100_000), incasso('2026-01-20', 50_000), incasso('2026-02-15', 200_000), incasso('2026-03-01', 70_000),
  incasso('2026-02-20', 999_000, { stato: 'da_incassare', dataIncasso: undefined }),
  incasso('2025-01-10', 100_000), incasso('2025-03-03', 80_000),
];
const spese: Spesa[] = [
  spesa('2026-01-05', 30_000, 'affitto_studio'), spesa('2026-03-01', 10_000, 'utenze'), spesa('2026-03-01', 5_000, 'software'),
  spesa('2026-02-28', 50_000, 'contributi_enpam'), spesa('2026-03-01', 70_000, 'imposte_f24'),
];

describe('Analisi', () => {
  it('serie mensili: incassi per data di incasso, spese professionali per data di pagamento', () => {
    const s = serieMensili(fatture, spese, 2026, p);
    expect(s).toHaveLength(12);
    expect(s.slice(0, 4)).toEqual([
      { mese: 1, incassi: 150_000, spese: 30_000, netto: 120_000 },
      { mese: 2, incassi: 200_000, spese: 0, netto: 200_000 },
      { mese: 3, incassi: 70_000, spese: 15_000, netto: 55_000 },
      { mese: 4, incassi: 0, spese: 0, netto: 0 },
    ]);
    expect(serieMensili(fatture, spese, 2026, p, '2026-02-28')[2]).toEqual({ mese: 3, incassi: 0, spese: 0, netto: 0 });
  });

  it('spese per categoria, dalla più alta, senza ENPAM e F24', () => {
    expect(spesePerCategoria(spese, 2026)).toEqual([
      { categoria: 'affitto_studio', importo: 30_000, quota: 0.6666666666666666 },
      { categoria: 'utenze', importo: 10_000, quota: 0.2222222222222222 },
      { categoria: 'software', importo: 5_000, quota: 0.1111111111111111 },
    ]);
    expect(spesePerCategoria(spese, 2025)).toEqual([]);
  });

  it('confronto con lo stesso periodo dell\'anno precedente', () => {
    const c = confrontoAnnoPrecedente(fatture, spese, '2026-03-01');
    expect(c.stessoGiornoAnnoPrecedente).toBe('2025-03-01');
    expect(c.totale).toEqual({ incassi: 420_000, spese: 45_000, netto: 375_000 });
    expect(c.totalePrecedente).toEqual({ incassi: 100_000, spese: 0, netto: 100_000 });
    expect(c.variazioneIncassi).toBe(3.2);
    expect(c.mesi[2].annoPrecedente.incassi).toBe(80_000); // il grafico mostra l'anno precedente intero
  });

  it('confronto: 29 febbraio e anno precedente senza incassi', () => {
    const c = confrontoAnnoPrecedente([], [], '2028-02-29');
    expect(c.stessoGiornoAnnoPrecedente).toBe('2027-02-28');
    expect(c.variazioneIncassi).toBeUndefined();
  });

  it('dove vanno 100 €: scenario D1 (attesi: scripts/atteso_dashboard.py)', () => {
    const sc = SCENARI_DASHBOARD.find((x) => x.id === 'D1');
    if (!sc) throw new Error('D1 mancante');
    const r = calcolaRiepilogo({
      oggi: sc.input.oggi, profilo: sc.input.profilo, spese: sc.input.spese,
      fatture: sc.input.incassi.map((x, i) => incasso(x.data, x.imponibile, { numero: `D1-${i + 1}` })),
    });
    expect(doveVanno100Euro(r)).toEqual({ spese: 0, imposte: 966, contributi: 1_530, netto: 7_504 });
  });

  it('dove vanno 100 €: senza ricavi non c\'è nulla da mostrare', () => {
    const r = calcolaRiepilogo({ oggi: '2026-06-30', profilo: SCENARI_DASHBOARD[0].input.profilo, fatture: [], spese: [] });
    expect(doveVanno100Euro(r)).toBeUndefined();
  });
});
