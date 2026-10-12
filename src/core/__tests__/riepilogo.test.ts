import { describe, expect, it } from 'vitest';
import { liquidazioniIva, proRata } from '../iva';
import { euro } from '../money';
import { bolloDovuto, creditiAperti, nettoIncassato, ricaviAnno } from '../movimenti';
import { getParametri } from '../params';
import { puoAggiungere, puoUsare } from '../piani';
import { csvFatture, csvSpese } from '../report';
import { calcolaRiepilogo } from '../riepilogo';
import type { Fattura, Profilo, Spesa } from '../types';

const p = getParametri(2026).parametri;

let n = 0;
const fattura = (x: Partial<Fattura>): Fattura => ({
  id: `f${++n}`, numero: String(n), dataFattura: '2026-01-15', imponibile: euro(100), trattamentoIva: 'forfettario_no_iva',
  bolloAddebitato: true, destinatario: 'paziente', elettronica: false, stato: 'incassata', dataIncasso: '2026-01-15', origine: 'manuale',
  ...x,
});

const profiloForf: Profilo = {
  regime: 'forfettario', dataNascita: '1991-05-10', annoInizioAttivita: 2023, requisitiStartup5: true,
  rateQuotaA: 1, rateQuotaB: 1, emetteFattureElettroniche: false,
};

describe('Movimenti', () => {
  it('bollo dovuto solo sopra 77,47 € e senza IVA', () => {
    expect(bolloDovuto({ imponibile: euro(77.47), trattamentoIva: 'esente_art10' }, p)).toBe(false);
    expect(bolloDovuto({ imponibile: euro(77.48), trattamentoIva: 'esente_art10' }, p)).toBe(true);
    expect(bolloDovuto({ imponibile: euro(500), trattamentoIva: 'imponibile_22' }, p)).toBe(false);
  });

  it('principio di cassa: conta la data di incasso, non della fattura', () => {
    const f = [
      fattura({ dataFattura: '2025-12-20', dataIncasso: '2026-01-10', imponibile: euro(200) }),
      fattura({ dataFattura: '2026-12-20', stato: 'da_incassare', dataIncasso: undefined, imponibile: euro(300) }),
    ];
    expect(ricaviAnno(f, 2026, p)).toBe(euro(200));
  });

  it('netto incassato toglie la ritenuta', () => {
    const f = fattura({ trattamentoIva: 'esente_art10', bolloAddebitato: false, imponibile: euro(1_000), ritenutaAcconto: euro(200), destinatario: 'struttura' });
    expect(nettoIncassato(f, p)).toBe(euro(800));
  });

  it('crediti aperti ordinati dal più vecchio', () => {
    const c = creditiAperti([
      fattura({ dataFattura: '2026-05-01', stato: 'da_incassare', dataIncasso: undefined }),
      fattura({ dataFattura: '2026-02-01', stato: 'da_incassare', dataIncasso: undefined }),
    ], '2026-06-01', p);
    expect(c.map((x) => x.giorni)).toEqual([120, 31]);
  });
});

describe('IVA ordinario', () => {
  const fatture = [
    fattura({ trattamentoIva: 'esente_art10', imponibile: euro(8_000), dataFattura: '2026-02-10' }),
    fattura({ trattamentoIva: 'imponibile_22', imponibile: euro(2_000), dataFattura: '2026-03-10', bolloAddebitato: false }),
  ];
  const spese: Spesa[] = [{ id: 's1', data: '2026-03-01', importo: euro(610), iva: euro(110), categoria: 'software' }];

  it('pro-rata arrotondato all\'unità superiore', () => {
    expect(proRata(fatture, 2026)).toBe(0.2);
    expect(proRata([fatture[0]], 2026)).toBe(0);
    expect(proRata([fatture[1]], 2026)).toBe(1);
  });

  it('liquidazione 1° trimestre con interessi 1%', () => {
    const r = liquidazioniIva(fatture, spese, 2026, p);
    const t1 = r.trimestri[0];
    expect(t1.ivaDebito).toBe(euro(440));
    expect(t1.ivaCredito).toBe(euro(22));
    expect(t1.interessi).toBe(euro(4.18));
    expect(t1.daVersare).toBe(euro(422.18));
  });
});

describe('Riepilogo (dashboard)', () => {
  const fatture: Fattura[] = [
    fattura({ imponibile: euro(10_000), dataIncasso: '2026-02-15' }),
    fattura({ imponibile: euro(10_000), dataIncasso: '2026-05-15' }),
    fattura({ imponibile: euro(500), dataIncasso: '2026-08-01' }), // futura rispetto a "oggi"
    fattura({ imponibile: euro(300), dataFattura: '2026-03-01', stato: 'da_incassare', dataIncasso: undefined }),
    fattura({ imponibile: euro(150), dataFattura: '2025-11-10', dataIncasso: '2025-11-10', inviataSTS: false }),
  ];
  const spese: Spesa[] = [
    { id: 'e1', data: '2026-04-30', importo: euro(592.94), categoria: 'contributi_enpam' },
    { id: 'e2', data: '2026-03-01', importo: euro(1_200), categoria: 'affitto_studio' },
  ];

  const r = calcolaRiepilogo({
    oggi: '2026-06-30',
    profilo: { ...profiloForf, annoPrecedente: { anno: 2025, impostaDifferenza: euro(1_000), accontiVersati: euro(800), redditoProfessionale: euro(20_000) } },
    fatture, spese,
  });

  it('ricavi solo incassati fino a oggi', () => {
    expect(r.ricavi).toBe(euro(20_000));
    expect(r.speseProfessionali).toBe(euro(1_200));
    expect(r.contributiVersati).toBe(euro(592.94));
  });

  it('imposta forfettaria da inizio anno', () => {
    // 20.000 × 78% = 15.600 − 592,94 = 15.007,06 × 5% = 750,353 -> 750,35
    expect(r.daInizioAnno.imposte).toBe(euro(750.35));
  });

  it('da accantonare = imposta + Quota B maturata + Quota A non ancora versata', () => {
    // Quota B: 15.600 − 5.446,77 = 10.153,23 × 19,5% = 1.979,88
    expect(r.quotaBMaturata.totale).toBe(euro(1_979.88));
    expect(r.daAccantonare).toBe(r.daInizioAnno.imposte + r.quotaBMaturata.totale);
  });

  it('percentuale verso il limite forfettario', () => {
    expect(r.percentualeLimiteForfettario).toBeCloseTo(20_000 / 85_000, 6);
  });

  it('scadenze con importi stimati e saldo', () => {
    const saldo = r.scadenze.find((s) => s.id === 'saldo-primo-acconto');
    // saldo 2025: 1.000 − 800 = 200; primo acconto 50% di 1.000 = 500
    expect(saldo?.importoStimato).toBe(euro(700));
    expect(r.scadenze.find((s) => s.id === 'secondo-acconto')?.importoStimato).toBe(euro(500));
  });

  it('avvisi: fatture 2025 non inviate al Sistema TS', () => {
    expect(r.avvisi.map((a) => a.codice)).toContain('STS_DA_INVIARE');
    expect(r.crediti).toHaveLength(1);
    expect(r.parametriDaVerificare.length).toBeGreaterThan(0);
  });

  it('ordinario: calcola anche IVA e addizionali', () => {
    const ord = calcolaRiepilogo({
      oggi: '2026-06-30',
      profilo: { ...profiloForf, regime: 'ordinario', regione: 'SAR' },
      fatture: [fattura({ trattamentoIva: 'esente_art10', imponibile: euro(30_000), dataIncasso: '2026-03-01' })],
      spese,
    });
    expect(ord.daInizioAnno.regime).toBe('ordinario');
    expect(ord.iva?.soloEsenti).toBe(true);
    expect(ord.scadenze.some((s) => s.categoria === 'iva')).toBe(false);
  });
});

describe('Piani', () => {
  it('limiti e funzioni', () => {
    expect(puoAggiungere('free', 'fattura', 29).consentito).toBe(true);
    expect(puoAggiungere('free', 'fattura', 30).consentito).toBe(false);
    expect(puoAggiungere('pro', 'fattura', 10_000).consentito).toBe(true);
    expect(puoUsare('free', 'report_pdf')).toBe(false);
    expect(puoUsare('pro', 'lettura_foto')).toBe(true);
  });
});

describe('Report CSV', () => {
  it('formato italiano, nome paziente escluso di default', () => {
    const f = [fattura({ numero: '1', nomePaziente: 'Mario Rossi', tipoPrestazione: 'Visita; controllo', imponibile: euro(150) })];
    const csv = csvFatture(f, 2026, p);
    expect(csv.split('\n')[0]).toContain('Numero;Data fattura');
    expect(csv).toContain('150,00');
    expect(csv).toContain('"Visita; controllo"');
    expect(csv).not.toContain('Mario Rossi');
    expect(csvFatture(f, 2026, p, { includiNomePaziente: true })).toContain('Mario Rossi');
  });

  it('spese', () => {
    const csv = csvSpese([{ id: '1', data: '2026-01-02', importo: euro(10), categoria: 'altro' }], 2026);
    expect(csv.split('\n')).toHaveLength(2);
  });
});
