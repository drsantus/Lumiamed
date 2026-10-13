import { describe, expect, it } from 'vitest';
import { liquidazioniIva, proRata } from '../iva';
import { euro } from '../money';
import { bolloDovuto, creditiAperti, nettoIncassato, ricaviAnno } from '../movimenti';
import { getParametri } from '../params';
import { puoAggiungere, puoUsare } from '../piani';
import { csvFatture, csvSpese } from '../report';
import { calcolaRiepilogo } from '../riepilogo';
import type { Fattura, Profilo, Spesa } from '../types';
import { attribuisciVersamenti } from '../versamenti';
import { SCENARI_DASHBOARD } from './scenari';

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

  it('pro-rata esatto non sale di un punto per la virgola mobile', () => {
    // 7 / (7 + 93) × 100 in virgola mobile vale 7,000000000000001
    const f = [
      fattura({ trattamentoIva: 'imponibile_22', imponibile: euro(7), dataFattura: '2026-03-10', bolloAddebitato: false }),
      fattura({ trattamentoIva: 'esente_art10', imponibile: euro(93), dataFattura: '2026-03-10' }),
    ];
    expect(proRata(f, 2026)).toBe(0.07);
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

  it('Quota B maturata: soglia in proporzione ai giorni trascorsi', () => {
    // 15.600 − 5.446,77 × 181/365 = 15.600 − 2.701,00 = 12.899,00 × 19,5% = 2.515,31
    expect(r.quotaBMaturata.soglia).toBe(euro(2_701));
    expect(r.quotaBMaturata.totale).toBe(euro(2_515.31));
  });

  it('da accantonare = imposte nette + Quota A residua + Quota B maturata + IVA', () => {
    const a = r.accantonamento;
    // Quota A 2026 (34 anni fino a maggio, 35 da giugno) = 950,94; versati 592,94 il 30/4 (senza riferimento: attribuiti alla Quota A)
    expect(r.quotaA.totale).toBe(euro(950.94));
    expect(a.quotaAResidua).toBe(euro(358));
    expect(a.metodo).toBe('proiezione');
    expect(a.imposte).toBe(a.imposteMaturate - a.ritenute - a.accontiVersati);
    expect(r.daAccantonare).toBe(a.imposte + a.quotaAResidua + a.quotaBMaturata + a.iva);
    expect(r.avvisi.map((x) => x.codice)).toContain('VERSAMENTI_DEDOTTI');
  });

  it('impegni dell\'anno scorso: saldo 200 + Quota B 2025 su 20.000 € (2.837,88)', () => {
    expect(r.impegniAnnoPrecedente).toEqual({ anno: 2025, saldoImposte: euro(200), saldoAddizionali: 0, quotaB: euro(2_837.88), totale: euro(3_037.88) });
    expect(r.liquiditaImpegnata).toBe(r.daAccantonare + euro(3_037.88));
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

describe('Dashboard — scenari per il commercialista', () => {
  it.each(SCENARI_DASHBOARD)('$id: $descrizione', (sc) => {
    const fatture = sc.input.incassi.map((x, i) => fattura({
      numero: `${sc.id}-${i + 1}`, dataFattura: x.data, dataIncasso: x.data, imponibile: x.imponibile,
      trattamentoIva: x.trattamentoIva, destinatario: x.destinatario, ritenutaAcconto: x.ritenuta, bolloAddebitato: false,
    }));
    const r = calcolaRiepilogo({ oggi: sc.input.oggi, profilo: sc.input.profilo, fatture, spese: sc.input.spese });
    const a = r.accantonamento;
    expect(a.metodo).toBe(sc.atteso.metodo);
    expect(a.imposteMaturate).toBe(sc.atteso.imposteMaturate);
    expect(a.imposte).toBe(sc.atteso.imposte);
    expect(a.quotaAResidua).toBe(sc.atteso.quotaAResidua);
    expect(a.quotaBMaturata).toBe(sc.atteso.quotaBMaturata);
    expect(a.iva).toBe(sc.atteso.iva);
    expect(r.daAccantonare).toBe(sc.atteso.daAccantonare);
    expect(r.impegniAnnoPrecedente?.totale).toBe(sc.atteso.impegniAnnoPrecedente);
    expect(r.guadagnoNetto).toBe(sc.atteso.guadagnoNetto);
  });
});

describe('Correzioni del 13/10 sui numeri della dashboard', () => {
  const ord: Profilo = { ...profiloForf, regime: 'ordinario', dataNascita: '1980-01-01', regione: 'SAR' };
  const mensili = (annuo: number, extra: Partial<Fattura> = {}) => Array.from({ length: 12 }, (_, i) => {
    const d = `2026-${String(i + 1).padStart(2, '0')}-15`;
    return fattura({ imponibile: euro(annuo / 12), dataFattura: d, dataIncasso: d, trattamentoIva: 'esente_art10', bolloAddebitato: false, ...extra });
  });

  it('ordinario: le imposte maturate seguono l\'imposta annua, non gli scaglioni sul reddito parziale', () => {
    const fatt = mensili(90_000);
    const fine = calcolaRiepilogo({ oggi: '2026-12-31', profilo: ord, fatture: fatt, spese: [] });
    const marzo = calcolaRiepilogo({ oggi: '2026-03-31', profilo: ord, fatture: fatt, spese: [] });
    const quotaAttesa = fine.accantonamento.imposteMaturate * (marzo.ricavi / fine.ricavi);
    // prima della correzione: −40,5%
    expect(Math.abs(marzo.accantonamento.imposteMaturate / quotaAttesa - 1)).toBeLessThan(0.02);
  });

  it('ritenute subite tolte dal da accantonare', () => {
    const fatt = [fattura({ imponibile: euro(30_000), trattamentoIva: 'esente_art10', bolloAddebitato: false, destinatario: 'struttura', ritenutaAcconto: euro(6_000), dataFattura: '2026-06-01', dataIncasso: '2026-06-01' })];
    const r = calcolaRiepilogo({ oggi: '2026-06-30', profilo: ord, fatture: fatt, spese: [] });
    expect(r.accantonamento.ritenute).toBe(euro(6_000));
    expect(r.accantonamento.imposte).toBe(Math.max(0, r.accantonamento.imposteMaturate - euro(6_000)));
  });

  it('acconti F24 già versati tolti dal da accantonare', () => {
    const prof: Profilo = { ...profiloForf, requisitiStartup5: false };
    const fatt = mensili(60_000, { trattamentoIva: 'forfettario_no_iva' });
    const senza = calcolaRiepilogo({ oggi: '2026-12-01', profilo: prof, fatture: fatt, spese: [] });
    const con = calcolaRiepilogo({
      oggi: '2026-12-01', profilo: prof, fatture: fatt,
      spese: [{ id: 'f24', data: '2026-11-30', importo: euro(3_000), categoria: 'imposte_f24', riferimento: { tributo: 'imposta', anno: 2026, tipo: 'acconto' } }],
    });
    expect(senza.daAccantonare - con.daAccantonare).toBe(euro(3_000));
  });

  it('IVA 22%: il netto non sottrae l\'IVA, il da accantonare la include', () => {
    const esente = [fattura({ imponibile: euro(12_000), trattamentoIva: 'esente_art10', bolloAddebitato: false, dataFattura: '2026-05-01', dataIncasso: '2026-05-01' })];
    const conIva = [fattura({ imponibile: euro(12_000), trattamentoIva: 'imponibile_22', bolloAddebitato: false, dataFattura: '2026-05-01', dataIncasso: '2026-05-01' })];
    const a = calcolaRiepilogo({ oggi: '2026-06-30', profilo: ord, fatture: esente, spese: [] });
    const b = calcolaRiepilogo({ oggi: '2026-06-30', profilo: ord, fatture: conIva, spese: [] });
    expect(b.guadagnoNetto).toBe(a.guadagnoNetto);
    expect(b.accantonamento.iva).toBe(euro(2_666.4)); // 2.640 + 1% di interessi
    expect(b.daAccantonare - a.daAccantonare).toBe(euro(2_666.4));
  });

  it('proiezione: la Quota B dell\'anno scorso che scade entro dicembre è deducibile', () => {
    const prof: Profilo = { ...profiloForf, requisitiStartup5: false, dataNascita: '1980-01-01', annoPrecedente: { anno: 2025, impostaDifferenza: euro(8_000), redditoProfessionale: euro(70_000) } };
    const fatt = mensili(90_000, { trattamentoIva: 'forfettario_no_iva' });
    const unica = calcolaRiepilogo({ oggi: '2026-06-30', profilo: prof, fatture: fatt, spese: [] });
    const noveRate = calcolaRiepilogo({ oggi: '2026-06-30', profilo: { ...prof, rateQuotaB: 9 }, fatture: fatt, spese: [] });
    const qbPrec = euro(11_688.44); // (70.000 − 10.059,28) × 19,5%
    // con 9 rate solo 3 (ottobre-dicembre) cadono nel 2026: deducibile 1/3
    const atteso = qbPrec * (2 / 3) * 0.15; // 1.168,84 di imposta in più con 9 rate
    expect(Math.abs(noveRate.proiezione.imposte - unica.proiezione.imposte - atteso)).toBeLessThanOrEqual(1);
  });

  it('Quota A non sparisce quando a gennaio-marzo si pagano rate di Quota B', () => {
    const fatt = mensili(60_000, { trattamentoIva: 'forfettario_no_iva' });
    const rate: Spesa[] = ['01', '02', '03'].map((m) => ({ id: m, data: `2026-${m}-28`, importo: euro(1_000), categoria: 'contributi_enpam' }));
    const r = calcolaRiepilogo({ oggi: '2026-04-15', profilo: { ...profiloForf, rateQuotaB: 9 }, fatture: fatt, spese: rate });
    expect(r.accantonamento.quotaAResidua).toBe(r.quotaA.totale);
  });

  it('ordinario: la scadenza di luglio include il saldo delle addizionali', () => {
    const prof: Profilo = {
      ...ord,
      annoPrecedente: { anno: 2025, impostaDifferenza: euro(15_000), accontiVersati: euro(12_000), addizionaleRegionale: euro(760), addizionaleComunale: euro(500), redditoProfessionale: euro(70_000) },
    };
    const r = calcolaRiepilogo({ oggi: '2026-06-01', profilo: prof, fatture: mensili(70_000), spese: [] });
    // saldo 3.000 + addizionali (760 + 500 − 30% di 500 = 1.110) + 1° acconto 7.500 + acconto comunale 150
    expect(r.scadenze.find((s) => s.id === 'saldo-primo-acconto')?.importoStimato).toBe(euro(11_760));
    expect(r.impegniAnnoPrecedente?.saldoAddizionali).toBe(euro(1_110));
  });

  it('forfettario: passaggio dal 5% al 15% riproporziona l\'aliquota dell\'anno scorso', () => {
    const prof: Profilo = {
      ...profiloForf, annoInizioAttivita: 2021, requisitiStartup5: true,
      annoPrecedente: { anno: 2025, impostaDifferenza: euro(2_000), ricavi: euro(50_000) },
    };
    const r = calcolaRiepilogo({ oggi: '2026-02-10', profilo: prof, fatture: [fattura({ imponibile: euro(10_000), dataIncasso: '2026-01-20' })], spese: [] });
    // 2.000 / 50.000 = 4% al 5% → 12% al 15%
    expect(r.accantonamento.metodo).toBe('anno_precedente');
    expect(r.accantonamento.imposteMaturate).toBe(euro(1_200));
  });
});

describe('Attribuzione dei versamenti senza riferimento', () => {
  it('F24 di luglio: prima il saldo dell\'anno scorso, poi il primo acconto', () => {
    const r = attribuisciVersamenti(
      [{ id: 'a', data: '2026-07-20', importo: euro(3_000), categoria: 'imposte_f24' }],
      { anno: 2026, oggi: '2026-12-31', quotaAAnnua: 0, saldoImposteAnnoPrecedente: euro(2_000) },
    );
    expect(r.versamenti.map((v) => [v.riferimento.anno, v.riferimento.tipo, v.importo])).toEqual([[2025, 'saldo', euro(2_000)], [2026, 'acconto', euro(1_000)]]);
  });

  it('ENPAM da aprile: prima la Quota A fino al suo importo, il resto è Quota B', () => {
    const r = attribuisciVersamenti(
      [{ id: 'a', data: '2026-10-31', importo: euro(5_000), categoria: 'contributi_enpam' }],
      { anno: 2026, oggi: '2026-12-31', quotaAAnnua: euro(2_000) },
    );
    expect(r.versamenti.map((v) => [v.riferimento.tributo, v.riferimento.anno, v.importo])).toEqual([
      ['enpam_quota_a', 2026, euro(2_000)], ['enpam_quota_b', 2025, euro(3_000)],
    ]);
  });

  it('F24 di marzo senza riferimento: non attribuito, con avviso', () => {
    const r = attribuisciVersamenti([{ id: 'a', data: '2026-03-16', importo: euro(500), categoria: 'imposte_f24' }], { anno: 2026, oggi: '2026-12-31', quotaAAnnua: 0 });
    expect(r.versamenti).toHaveLength(0);
    expect(r.avvisi.map((a) => a.codice)).toContain('VERSAMENTI_NON_ATTRIBUITI');
  });

  it('il riferimento indicato dall\'utente vince sulla data', () => {
    const r = attribuisciVersamenti(
      [{ id: 'a', data: '2026-07-20', importo: euro(800), categoria: 'imposte_f24', riferimento: { tributo: 'iva', anno: 2026 } }],
      { anno: 2026, oggi: '2026-12-31', quotaAAnnua: 0, saldoImposteAnnoPrecedente: euro(2_000) },
    );
    expect(r.versamenti[0]).toMatchObject({ importo: euro(800), dedotto: false, riferimento: { tributo: 'iva' } });
    expect(r.avvisi).toHaveLength(0);
  });

  it('Quota A in 4 rate: la rata di Quota B di ottobre non copre l\'ultima rata di Quota A', () => {
    const enpam = (id: string, data: string, importo: number): Spesa => ({ id, data, importo: euro(importo), categoria: 'contributi_enpam' });
    const r = attribuisciVersamenti(
      [enpam('a1', '2026-04-30', 514.27), enpam('a2', '2026-06-30', 514.27), enpam('a3', '2026-09-30', 514.27), enpam('b1', '2026-10-31', 5_103.22)],
      { anno: 2026, oggi: '2026-10-31', quotaAAnnua: euro(2_057.1), rateQuotaA: 4, rateQuotaB: 2 },
    );
    expect(r.versamenti.filter((v) => v.spesaId === 'b1').map((v) => [v.riferimento.tributo, v.importo])).toEqual([['enpam_quota_b', euro(5_103.22)]]);
  });

  it('ENPAM a luglio oltre la Quota A (pagata due volte): eccedenza non attribuita, con avviso', () => {
    const qa = (id: string, data: string): Spesa => ({ id, data, importo: euro(2_057.1), categoria: 'contributi_enpam' });
    const r = attribuisciVersamenti([qa('a', '2026-04-30'), qa('b', '2026-07-15')], { anno: 2026, oggi: '2026-07-31', quotaAAnnua: euro(2_057.1) });
    expect(r.versamenti.map((v) => [v.spesaId, v.riferimento.tributo, v.importo])).toEqual([['a', 'enpam_quota_a', euro(2_057.1)]]);
    expect(r.avvisi.map((a) => a.codice)).toContain('VERSAMENTI_ENPAM_ECCEDENTI');
  });

  it('F24 di agosto nell\'ordinario con IVA: prima l\'IVA del 2° trimestre, poi le imposte', () => {
    const r = attribuisciVersamenti(
      [{ id: 'a', data: '2026-08-20', importo: euro(3_000), categoria: 'imposte_f24' }],
      { anno: 2026, oggi: '2026-08-31', quotaAAnnua: 0, ivaTrimestri: { 2: euro(2_666.4) } },
    );
    expect(r.versamenti.map((v) => [v.riferimento.tributo, v.riferimento.tipo, v.importo])).toEqual([
      ['iva', undefined, euro(2_666.4)], ['imposta', 'acconto', euro(333.6)],
    ]);
  });
});
