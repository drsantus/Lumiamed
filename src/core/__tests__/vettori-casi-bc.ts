/**
 * Vettori golden dei test aggiunti con i Pacchetti B e C (abbonamento, storico, analisi, parametri 2025-2027,
 * altri redditi, validazione, backup, scadenziario su 12 mesi, ...). Stesse regole di vettori-casi.ts:
 * attesi trascritti dai test, solo valori letterali.
 */
import { euro } from '../money';
import type { Fattura, Profilo, Spesa } from '../types';
import type { Espr, Vettore } from './vettori-casi';
import { SCENARI_DASHBOARD } from './scenari';

const P = (anno = 2026, campo?: string) => (campo ? { $parametri: anno, campo } : { $parametri: anno });
const r = (percorso: string): Espr => ({ $: percorso });
const da = (chiamata: string) => ({ $risultatoDi: chiamata });

const FISCALE = 'fiscale.test.ts';
const OCR = 'ocr.test.ts';
const RIEPILOGO = 'riepilogo.test.ts';
const SCADENZIARIO = 'scadenziario.test.ts';
const STORICO = 'storico.test.ts';
const ANALISI = 'analisi.test.ts';
const VALIDAZIONE = 'validazione.test.ts';
const BACKUP = 'backup.test.ts';

/** Scaglioni IRPEF 2026 come in params/2026.ts (dati, non calcoli). */
const SCAGLIONI_2026 = [{ fino: 2_800_000, aliquota: 0.23 }, { fino: 5_000_000, aliquota: 0.33 }, { fino: null, aliquota: 0.43 }];

export interface ComuneTabella { codiceCatastale: string; comune: string; senzaDelibera?: boolean }

export function vettoriPacchettiBC(
  add: (v: Vettore) => void,
  fattura: (x: Partial<Fattura>) => Fattura,
  profiloForf: Profilo,
  comuni: ComuneTabella[],
): void {
  // ───────────────────────── fiscale.test.ts ─────────────────────────
  const dEnpam = 'ENPAM';
  add({
    id: 'enpam/quota-b-ridotta-under40', origine: `${FISCALE} › ${dEnpam} › Quota B ad aliquota ridotta 9,75%: l'1% oltre il massimale non cambia`,
    funzione: 'quotaB', input: { annoReddito: 2026, redditoProfessionale: euro(31_200), dataNascita: '1991-05-10', p: P(), frazioneAnno: 1, aliquota: 0.0975 },
    atteso: { totale: 248_704 },
  });
  add({
    id: 'enpam/quota-b-ridotta-over40', origine: `${FISCALE} › ${dEnpam} › Quota B ad aliquota ridotta 9,75%: l'1% oltre il massimale non cambia`,
    funzione: 'quotaB', input: { annoReddito: 2026, redditoProfessionale: euro(160_000), dataNascita: '1975-01-01', p: P(), frazioneAnno: 1, aliquota: 0.0975 },
    atteso: { aliquota: 0.0975, quotaOltreMassimale: euro(100), totale: 1_370_008 },
  });
  add({
    id: 'enpam/quota-b-redditi-2025', origine: `${FISCALE} › ${dEnpam} › Quota B sui redditi 2025: soglie 2025 (5.446,77 € under 40)`,
    funzione: 'quotaB', input: { annoReddito: 2025, redditoProfessionale: euro(20_000), dataNascita: '1991-05-10', p: P(2025) },
    atteso: { soglia: 544_677, totale: 283_788 },
  });

  const dPar = 'Parametri';
  add({
    id: 'parametri/2026-enpam', origine: `${FISCALE} › ${dPar} › 2026: Quota A da enpam.it verificata, soglie Quota B stimate`,
    funzione: 'getParametri', input: { anno: 2026 },
    atteso: {
      parametri: {
        enpam: {
          quotaA: {
            fasce: [{ importoAnnuo: 30_473 }, { importoAnnuo: 59_147 }, { importoAnnuo: 110_992 }, { importoAnnuo: 204_983 }],
            contributoMaternita: 8_426, studenti: 15_237,
          },
        },
        forfettario: { sogliaRedditiDipendente: { importo: euro(35_000) } },
      },
    },
  });
  add({
    id: 'parametri/2026-da-verificare', origine: `${FISCALE} › ${dPar} › 2026: Quota A da enpam.it verificata, soglie Quota B stimate`,
    funzione: 'parametriDaVerificare', input: { p: P(2026) },
    verifiche: [
      { valore: r(''), op: 'nonContiene', atteso: 'enpam.quotaA' },
      { valore: r(''), op: 'contiene', atteso: 'enpam.quotaB.sogliaEsenzione' },
      { valore: r(''), op: 'contiene', atteso: 'forfettario.sogliaRedditiDipendente' },
    ],
  });
  add({
    id: 'parametri/2025-parziale', origine: `${FISCALE} › ${dPar} › 2025 parziale: soglie Quota B 2025, il resto dall'anno più vicino`,
    funzione: 'getParametri', input: { anno: 2025 },
    atteso: {
      approssimati: true,
      parametri: { anno: 2025, enpam: { quotaB: { sogliaEsenzione: { under40: 544_677, over40: 1_005_928, verificato: true } } }, irpef: { scaglioni: SCAGLIONI_2026 } },
    },
  });
  add({
    id: 'parametri/2027-provvisorio', origine: `${FISCALE} › ${dPar} › 2027 provvisorio: copia del 2026, tutto da verificare, soglia redditi dipendente 30.000 €`,
    funzione: 'getParametri', input: { anno: 2027 },
    atteso: {
      approssimati: false,
      parametri: { forfettario: { sogliaRedditiDipendente: { importo: euro(30_000) } }, irpef: { scaglioni: SCAGLIONI_2026 }, scadenze: { saldoPrimoAccontoIsa: '2027-06-30' } },
    },
  });
  add({
    id: 'parametri/2027-da-verificare', origine: `${FISCALE} › ${dPar} › 2027 provvisorio: copia del 2026, tutto da verificare, soglia redditi dipendente 30.000 €`,
    funzione: 'parametriDaVerificare', input: { p: P(2027) },
    verifiche: ['forfettario', 'irpef', 'detrazioneLavoroAutonomo', 'acconti', 'enpam', 'enpam.quotaA', 'enpam.quotaB.sogliaEsenzione', 'iva', 'bollo', 'spese', 'scadenze']
      .map((g) => ({ valore: r(''), op: 'contiene' as const, atteso: g })),
  });

  const dReq = 'Forfettario — requisiti dall\'anno precedente';
  const forf = { regime: 'forfettario' };
  ([
    ['dipendente-oltre', 'redditi da lavoro dipendente oltre 35.000 €: avviso, non blocco', { ...forf, redditiLavoroDipendenteAnnoPrecedente: euro(35_000.01) }, ['FORF_REDDITI_DIPENDENTE']],
    ['dipendente-soglia', 'redditi da lavoro dipendente oltre 35.000 €: avviso, non blocco', { ...forf, redditiLavoroDipendenteAnnoPrecedente: euro(35_000) }, []],
    ['rapporto-cessato', 'rapporto cessato entro il 31/12: nessun avviso', { ...forf, redditiLavoroDipendenteAnnoPrecedente: euro(60_000), rapportoCessatoEntro31_12: true }, []],
    ['ricavi-oltre', 'ricavi dell\'anno precedente oltre 85.000 €', { ...forf, annoPrecedente: { anno: 2025, impostaDifferenza: 0, ricavi: euro(85_000.01) } }, ['FORF_RICAVI_ANNO_PRECEDENTE']],
    ['ricavi-soglia', 'ricavi dell\'anno precedente oltre 85.000 €', { ...forf, annoPrecedente: { anno: 2025, impostaDifferenza: 0, ricavi: euro(85_000) } }, []],
    ['ordinario', 'ordinario: nessun avviso', { regime: 'ordinario', redditiLavoroDipendenteAnnoPrecedente: euro(60_000) }, []],
  ] as const).forEach(([slug, it, profilo, codici]) => add({
    id: `forfettario/requisiti-${slug}`, origine: `${FISCALE} › ${dReq} › ${it}`,
    funzione: 'avvisiRequisitiForfettario', input: { profilo, p: P() },
    verifiche: [{ valore: r('[*].codice'), op: 'uguale', atteso: [...codici] }],
  }));

  const dAltri = 'Ordinario con altri redditi — calcolo marginale';
  const ordinarioCon = (compensi: number, altriRedditi?: number) => ({
    input: { anno: 2026, compensi, spese: [], contributiVersati: 0, ritenuteSubite: 0, profilo: { regione: 'SAR' }, ...(altriRedditi === undefined ? {} : { altriRedditi }) },
    p: P(),
  });
  add({
    id: 'ordinario/altri-redditi-60k-30k', origine: `${FISCALE} › ${dAltri} › 60.000 € di stipendio e 30.000 € di reddito professionale`,
    funzione: 'calcolaOrdinario', input: ordinarioCon(euro(30_000), euro(60_000)),
    atteso: {
      redditoComplessivo: euro(90_000), impostaLorda: 1_290_000, detrazioneLavoroAutonomo: 0, impostaNetta: 1_290_000,
      addizionaleRegionale: 36_900, totaleImposte: 1_326_900, redditoProfessionale: euro(30_000),
    },
    verifiche: [
      { valore: r('avvisi[*].codice'), op: 'contiene', atteso: 'ORD_ALTRI_REDDITI' },
      { valore: r('avvisi[*].codice'), op: 'nonContiene', atteso: 'ORD_ALTRI_REDDITI_DETRAZIONE' },
    ],
  });
  add({
    id: 'ordinario/altri-redditi-20k-10k', origine: `${FISCALE} › ${dAltri} › stipendio sotto 50.000 €: stima approssimata, con avviso`,
    funzione: 'calcolaOrdinario', input: ordinarioCon(euro(10_000), euro(20_000)),
    atteso: { impostaNetta: 204_545, addizionaleRegionale: 12_300, totaleImposte: 216_845 },
    verifiche: [{ valore: r('avvisi[*].codice'), op: 'contiene', atteso: 'ORD_ALTRI_REDDITI_DETRAZIONE' }],
  });
  add({
    id: 'ordinario/altri-redditi-zero', origine: `${FISCALE} › ${dAltri} › senza altri redditi il risultato non cambia`,
    chiamate: {
      zero: { funzione: 'calcolaOrdinario', input: ordinarioCon(euro(30_000), 0) },
      assenti: { funzione: 'calcolaOrdinario', input: ordinarioCon(euro(30_000)) },
    },
    verifiche: [
      { valore: { $uguali: [r('zero'), r('assenti')] }, op: 'uguale', atteso: true },
      { valore: r('assenti.altriRedditi'), op: 'uguale', atteso: 0 },
    ],
  });

  add({
    id: 'acconti/fino-a-51-65', origine: `${FISCALE} › Acconti › acconto non dovuto se la differenza è fino a 51,65 € compresi`,
    funzione: 'pianoAcconti', input: { base: euro(51.65), p: P() }, atteso: { modalita: 'nessuno' },
  });
  add({
    id: 'acconti/oltre-51-65', origine: `${FISCALE} › Acconti › acconto non dovuto se la differenza è fino a 51,65 € compresi`,
    funzione: 'pianoAcconti', input: { base: euro(51.66), p: P() }, atteso: { modalita: 'unica_soluzione', primaRata: 0, secondaRata: euro(51.66) },
  });

  const dCom = 'Tabella comunale precaricata (dati MEF)';
  const itSenza = 'comuni senza delibere recenti (885, es. Portoscuso): si trovano con la ricerca, addizionale non stimata';
  add({ id: 'tabelle/comuni-totali', origine: `${FISCALE} › ${dCom} › ${itSenza}`, funzione: 'tabelleCaricate', input: {}, atteso: { comuni: 7_897, comuniSenzaDelibera: 885 } });
  add({
    id: 'tabelle/cerca-portoscuso', origine: `${FISCALE} › ${dCom} › ${itSenza}`, funzione: 'cercaComune', input: { testo: 'Portoscuso' },
    verifiche: [{ valore: r('[*].codiceCatastale'), op: 'uguale', atteso: ['G922'] }],
  });
  add({
    id: 'tabelle/comunale-senza-delibera', origine: `${FISCALE} › ${dCom} › ${itSenza}`,
    funzione: 'addizionaleComunale', input: { imponibile: euro(40_000), codiceCatastale: 'G922' },
    atteso: { importo: 0 },
    verifiche: [{ valore: r('avvisi[*].codice'), op: 'uguale', atteso: ['ADD_COM_SENZA_DELIBERA'] }],
  });
  for (const c of comuni.filter((x) => x.senzaDelibera)) {
    add({
      id: `tabelle/senza-delibera/${c.codiceCatastale}`, origine: `${FISCALE} › ${dCom} › ogni comune senza delibera si trova cercando il suo nome`,
      funzione: 'cercaComune', input: { testo: c.comune },
      verifiche: [{ valore: r('[*].codiceCatastale'), op: 'contiene', atteso: c.codiceCatastale }],
    });
  }

  // ───────────────────────── ocr.test.ts ─────────────────────────
  ([['0', 0], ['€ 1.234,56 EUR', 123_456], ['12.345.678', 1_234_567_800], ['1 234,56', 123_456]] as const).forEach(([raw, atteso], i) => add({
    id: `ocr/importo-valido-${i + 1}`, origine: `${OCR} › parseImporto › valido: ${raw} -> ${atteso}`, funzione: 'parseImporto', input: { raw }, atteso,
  }));
  ['-12,50', '−12,50', '+5', '1e3', '1E3', '2e-2', '12,345', '1,234.567', '1.2.3', 'abc', '', ',', '12,5,0', 'Infinity'].forEach((raw, i) => add({
    id: `ocr/importo-rifiutato-${i + 1}`, origine: `${OCR} › parseImporto › rifiutato: "${raw}" (niente negativi, notazione scientifica o più di 2 decimali)`,
    funzione: 'parseImporto', input: { raw }, atteso: null,
  }));

  // ───────────────────────── riepilogo.test.ts ─────────────────────────
  const dRiep = 'Riepilogo (dashboard)';
  const fattureRiep: Fattura[] = [
    fattura({ imponibile: euro(10_000), dataIncasso: '2026-02-15' }),
    fattura({ imponibile: euro(10_000), dataIncasso: '2026-05-15' }),
    fattura({ imponibile: euro(500), dataIncasso: '2026-08-01' }),
    fattura({ imponibile: euro(300), dataFattura: '2026-03-01', stato: 'da_incassare', dataIncasso: undefined }),
    fattura({ imponibile: euro(150), dataFattura: '2025-11-10', dataIncasso: '2025-11-10', inviataSTS: false }),
  ];
  const speseRiep: Spesa[] = [
    { id: 'e1', data: '2026-04-30', importo: euro(592.94), categoria: 'contributi_enpam' },
    { id: 'e2', data: '2026-03-01', importo: euro(1_200), categoria: 'affitto_studio' },
  ];
  const prec = { anno: 2025, impostaDifferenza: euro(1_000), accontiVersati: euro(800), redditoProfessionale: euro(20_000) };
  add({
    id: 'riepilogo/quota-b-ridotta', origine: `${RIEPILOGO} › ${dRiep} › Quota B ad aliquota ridotta nel profilo: vale per la maturata e per quella dell'anno scorso`,
    funzione: 'calcolaRiepilogo',
    input: { input: { oggi: '2026-06-30', profilo: { ...profiloForf, aliquotaQuotaB: 0.0975, annoPrecedente: prec }, fatture: fattureRiep, spese: speseRiep } },
    atteso: { quotaBMaturata: { totale: 124_580 }, impegniAnnoPrecedente: { quotaB: 141_894 } },
  });
  add({
    id: 'riepilogo/requisiti-forfettario', origine: `${RIEPILOGO} › ${dRiep} › forfettario: avviso sui redditi da lavoro dipendente dell'anno scorso`,
    funzione: 'calcolaRiepilogo',
    input: { input: { oggi: '2026-06-30', profilo: { ...profiloForf, redditiLavoroDipendenteAnnoPrecedente: euro(40_000) }, fatture: fattureRiep, spese: speseRiep } },
    verifiche: [{ valore: r('avvisi[*].codice'), op: 'contiene', atteso: 'FORF_REDDITI_DIPENDENTE' }],
  });
  add({
    id: 'riepilogo/ordinario-con-stipendio', origine: `${RIEPILOGO} › ${dRiep} › ordinario con stipendio: imposte marginali, stipendio maturato da inizio anno`,
    funzione: 'calcolaRiepilogo',
    input: {
      input: {
        oggi: '2026-06-30', profilo: { ...profiloForf, regime: 'ordinario', regione: 'SAR', redditoLavoroDipendente: euro(60_000) },
        fatture: [fattura({ trattamentoIva: 'esente_art10', imponibile: euro(30_000), dataIncasso: '2026-03-01' })], spese: speseRiep,
      },
    },
    atteso: { daInizioAnno: { dettaglio: { altriRedditi: 2_975_342 } }, proiezione: { dettaglio: { altriRedditi: euro(60_000) } } },
    verifiche: [{ valore: r('avvisi[*].codice'), op: 'contiene', atteso: 'ORD_ALTRI_REDDITI' }],
  });
  add({
    id: 'riepilogo/storico-niente-sts', origine: `${RIEPILOGO} › ${dRiep} › fatture caricate come storico: niente avviso del Sistema TS`,
    funzione: 'calcolaRiepilogo',
    input: { input: { oggi: '2026-06-30', profilo: profiloForf, spese: [], fatture: [fattura({ imponibile: euro(5_000), dataFattura: '2025-12-31', dataIncasso: '2025-12-31', storico: true })] } },
    verifiche: [{ valore: r('avvisi[*].codice'), op: 'nonContiene', atteso: 'STS_DA_INVIARE' }],
  });

  const dAbb = 'Abbonamento';
  const oggiAbb = '2026-06-30';
  const abb = (slug: string, it: string, input: Record<string, unknown>, atteso: unknown) => add({
    id: `abbonamento/${slug}`, origine: `${RIEPILOGO} › ${dAbb} › ${it}`, funzione: 'statoAbbonamento', input: { input: { oggi: oggiAbb, ...input } }, atteso,
  });
  const itStore = 'periodo dello store in corso: attivo, o prova se lo store lo indica';
  abb('store-attivo', itStore, { store: { prodotto: 'pro_annuale', scadenza: '2027-01-15' } }, { stato: 'attivo', prodotto: 'pro_annuale', finoAl: '2027-01-15' });
  abb('store-prova', itStore, { store: { prodotto: 'pro_mensile', scadenza: '2026-07-10', periodoDiProva: true } }, { stato: 'prova' });
  abb('ultimo-giorno-incluso', 'l\'ultimo giorno è incluso', { store: { prodotto: 'founding_annuale', scadenza: oggiAbb } }, { stato: 'attivo' });
  abb('giorno-dopo-scaduto', 'l\'ultimo giorno è incluso', { store: { prodotto: 'founding_annuale', scadenza: '2026-06-29' } }, { stato: 'scaduto' });
  const itApp = 'prova gestita dall\'app, senza acquisti nello store';
  abb('prova-app', itApp, { store: {}, fineProvaApp: '2026-07-01' }, { stato: 'prova', finoAl: '2026-07-01', prodotto: null });
  abb('prova-app-finita', itApp, { store: {}, fineProvaApp: '2026-06-29' }, { stato: 'scaduto' });
  abb('nessuna-prova', itApp, { store: {} }, { stato: 'scaduto' });
  abb('scaduto-con-prodotto', 'abbonamento scaduto: resta il prodotto, nessuna data', { store: { prodotto: 'pro_mensile', scadenza: '2026-05-31' } },
    { stato: 'scaduto', prodotto: 'pro_mensile', finoAl: null });
  const itFunz = 'scaduto = sola lettura ed export; nessun limite sul numero di movimenti';
  const funzioni: [string, string, boolean][] = [['scaduto', 'consultazione', true], ['scaduto', 'export', true]];
  for (const f of ['inserimento', 'import_storico', 'lettura_foto', 'notifiche_scadenze']) {
    funzioni.push(['scaduto', f, false], ['prova', f, true], ['attivo', f, true]);
  }
  funzioni.forEach(([stato, funzione, atteso]) => add({
    id: `abbonamento/funzione-${stato}-${funzione}`, origine: `${RIEPILOGO} › ${dAbb} › ${itFunz}`, funzione: 'puoUsare', input: { stato, funzione }, atteso,
  }));

  const dCsv = 'Report CSV';
  const itBom = 'BOM UTF-8 all\'inizio, per le lettere accentate in Excel';
  add({ id: 'report/bom-fatture', origine: `${RIEPILOGO} › ${dCsv} › ${itBom}`, funzione: 'csvFatture', input: { fatture: [], anno: 2026, p: P() },
    verifiche: [{ valore: r(''), op: 'corrisponde', atteso: '^﻿Numero;' }] });
  add({ id: 'report/bom-spese', origine: `${RIEPILOGO} › ${dCsv} › ${itBom}`, funzione: 'csvSpese', input: { spese: [], anno: 2026 },
    verifiche: [{ valore: r(''), op: 'corrisponde', atteso: '^﻿Data;' }] });

  add({
    id: 'riepilogo/scadenze-12-mesi', origine: `${RIEPILOGO} › Riepilogo — scadenze dei prossimi 12 mesi › a metà dicembre: nessuna scadenza passata, già presenti Sistema TS e Quota A dell'anno dopo`,
    funzione: 'calcolaRiepilogo', input: { input: { oggi: '2026-12-15', profilo: profiloForf, fatture: [], spese: [] } },
    atteso: { scadenzeImminenti: [] },
    verifiche: [
      { valore: r('scadenze[*].data'), op: 'tuttiNellIntervallo', atteso: ['2026-12-15', '2027-12-15'] },
      { valore: r('scadenze[id=sts].anno'), op: 'uguale', atteso: 2027 },
      { valore: r('scadenze[id=sts].data'), op: 'uguale', atteso: '2027-02-01' },
      { valore: r('scadenze[id=quotaA-1].anno'), op: 'uguale', atteso: 2027 },
      { valore: r('scadenze[id=quotaA-1].data'), op: 'uguale', atteso: '2027-04-30' },
    ],
  });

  // ───────────────────────── scadenziario.test.ts ─────────────────────────
  const dCal = 'Calendario';
  const it4 = '4 ottobre festivo dal 2026';
  add({ id: 'calendario/4-ottobre-2024', origine: `${SCADENZIARIO} › ${dCal} › ${it4}`, funzione: 'isGiornoLavorativo', input: { iso: '2024-10-04' }, atteso: true });
  add({ id: 'calendario/4-ottobre-2027', origine: `${SCADENZIARIO} › ${dCal} › ${it4}`, funzione: 'isGiornoLavorativo', input: { iso: '2027-10-04' }, atteso: false });
  add({ id: 'calendario/4-ottobre-2027-slitta', origine: `${SCADENZIARIO} › ${dCal} › ${it4}`, funzione: 'primoGiornoLavorativo', input: { iso: '2027-10-04' }, atteso: '2027-10-05' });
  add({ id: 'calendario/4-ottobre-2028-slitta', origine: `${SCADENZIARIO} › ${dCal} › ${it4}`, funzione: 'primoGiornoLavorativo', input: { iso: '2028-10-04' }, atteso: '2028-10-05' });

  const dSca = 'Scadenziario 2026';
  const base = { rateQuotaA: 1, rateQuotaB: 1, emetteFattureElettroniche: false } as const;
  add({
    id: 'scadenziario/dichiarazione-ed-enpam', origine: `${SCADENZIARIO} › ${dSca} › dichiarazione 31/10/2026 (sabato) → lunedì 2/11; le scadenze ENPAM non slittano`,
    funzione: 'generaScadenziario', input: { opt: { anno: 2026, profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false }, p: P() },
    verifiche: [
      { valore: r('[id=dichiarazione].dataNominale'), op: 'uguale', atteso: '2026-10-31' },
      { valore: r('[id=dichiarazione].data'), op: 'uguale', atteso: '2026-11-02' },
      { valore: r('[id=dichiarazione].anno'), op: 'uguale', atteso: 2026 },
      { valore: r('[id=quotaB-1].dataNominale'), op: 'uguale', atteso: '2026-10-31' },
      { valore: r('[id=quotaB-1].data'), op: 'uguale', atteso: '2026-10-31' },
      { valore: { $uguali: [r('[categoria~=^enpam$].data'), r('[categoria~=^enpam$].dataNominale')] }, op: 'uguale', atteso: true },
      { valore: { $uguali: [r('[id=modelloD].data'), r('[id=modelloD].dataNominale')] }, op: 'uguale', atteso: true },
    ],
  });
  add({
    id: 'scadenziario/finestra-15-dicembre', origine: `${SCADENZIARIO} › ${dSca} › finestra di 12 mesi: dal 15/12 compaiono il Sistema TS e le rate di gennaio dell'anno dopo`,
    funzione: 'scadenzeProssimi12Mesi',
    input: {
      opt: {
        oggi: '2026-12-15', profilo: { regime: 'forfettario', rateQuotaA: 1, rateQuotaB: 9, emetteFattureElettroniche: false },
        haOperazioniIva: false, importi: { quotaB: 500_000 },
      },
    },
    verifiche: [
      {
        valore: r('[*].id'), op: 'uguale',
        atteso: ['quotaB-3', 'quotaB-prec-4', 'sts', 'quotaB-prec-5', 'quotaB-prec-6', 'quotaA-1', 'quotaB-prec-7', 'quotaB-prec-8', 'quotaB-prec-9',
          'saldo-primo-acconto', 'modelloD', 'quotaB-1', 'dichiarazione', 'quotaB-2', 'secondo-acconto'],
      },
      { valore: r('[*].anno'), op: 'uguale', atteso: [2026, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027] },
      {
        valore: r('[*].data'), op: 'uguale',
        atteso: ['2026-12-31', '2027-01-31', '2027-02-01', '2027-02-28', '2027-03-31', '2027-04-30', '2027-04-30', '2027-05-31', '2027-06-30',
          '2027-06-30', '2027-07-31', '2027-10-31', '2027-11-02', '2027-11-30', '2027-11-30'],
      },
      { valore: r('[id=quotaB-prec-4].importoStimato'), op: 'uguale', atteso: 55_555 },
      { valore: r('[id=quotaB-prec-9].importoStimato'), op: 'uguale', atteso: 55_560 },
      { valore: r('[id=quotaB-3].importoStimato'), op: 'uguale', atteso: 55_555 },
    ],
  });
  const itConf = 'finestra di 12 mesi: oggi incluso, stesso giorno dell\'anno dopo escluso';
  add({
    id: 'scadenziario/finestra-oggi-incluso', origine: `${SCADENZIARIO} › ${dSca} › ${itConf}`,
    funzione: 'scadenzeProssimi12Mesi', input: { opt: { oggi: '2026-07-20', profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false } },
    verifiche: [
      { valore: r('[0].id'), op: 'uguale', atteso: 'saldo-primo-acconto' },
      { valore: r('[0].anno'), op: 'uguale', atteso: 2026 },
      { valore: r('[0].data'), op: 'uguale', atteso: '2026-07-20' },
    ],
  });
  add({
    id: 'scadenziario/finestra-fine-esclusa', origine: `${SCADENZIARIO} › ${dSca} › ${itConf}`,
    funzione: 'scadenzeProssimi12Mesi', input: { opt: { oggi: '2026-06-30', profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false } },
    verifiche: [
      { valore: r('[anno~=^2027$].id'), op: 'nonContiene', atteso: 'saldo-primo-acconto' },
      { valore: r('[anno~=^2027$].id'), op: 'contiene', atteso: 'quotaA-1' },
    ],
  });
  add({
    id: 'scadenziario/2027-provvisorio', origine: `${SCADENZIARIO} › ${dSca} › 2027: parametri provvisori con le date standard`,
    funzione: 'generaScadenziario', input: { opt: { anno: 2027, profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false }, p: P(2027) },
    verifiche: [
      { valore: r('[id=saldo-primo-acconto].dataNominale'), op: 'uguale', atteso: '2027-06-30' },
      { valore: r('[id=sts].dataNominale'), op: 'uguale', atteso: '2027-01-31' },
    ],
  });

  // ───────────────────────── storico.test.ts ─────────────────────────
  const opt = { anno: 2026, oggi: '2026-06-20', trattamentoIva: 'forfettario_no_iva', prefissoId: 'st' };
  const dMesi = 'Storico — totali mese per mese';
  add({
    id: 'storico/totali-mensili', origine: `${STORICO} › ${dMesi} › un incasso per mese e una spesa per categoria, datati a fine mese (o oggi per il mese in corso)`,
    funzione: 'storicoDaTotaliMensili',
    input: {
      mesi: [
        { mese: 2, incassi: 400_000, spese: { affitto_studio: 80_000, utenze: 0 } },
        { mese: 1, incassi: 300_000, ritenute: 60_000 },
        { mese: 6, incassi: 0, spese: { software: 5_000 } },
      ],
      opt,
    },
    atteso: {
      errori: [],
      fatture: [
        { id: 'st-2026-01', dataIncasso: '2026-01-31', imponibile: 300_000, ritenutaAcconto: 60_000, storico: true, stato: 'incassata', trattamentoIva: 'forfettario_no_iva', bolloAddebitato: false },
        { id: 'st-2026-02', dataIncasso: '2026-02-28', imponibile: 400_000, ritenutaAcconto: null, storico: true, stato: 'incassata', trattamentoIva: 'forfettario_no_iva', bolloAddebitato: false },
      ],
      spese: [
        { id: 'st-2026-02-affitto_studio', data: '2026-02-28', categoria: 'affitto_studio', importo: 80_000, storico: true },
        { id: 'st-2026-06-software', data: '2026-06-20', categoria: 'software', importo: 5_000, storico: true },
      ],
    },
  });
  add({
    id: 'storico/totali-mensili-ricavi', origine: `${STORICO} › ${dMesi} › un incasso per mese e una spesa per categoria, datati a fine mese (o oggi per il mese in corso)`,
    chiamate: {
      storico: { funzione: 'storicoDaTotaliMensili', input: { mesi: [{ mese: 2, incassi: 400_000 }, { mese: 1, incassi: 300_000, ritenute: 60_000 }], opt } },
      ricavi: { funzione: 'ricaviAnno', input: { fatture: { $risultatoDi: 'storico', percorso: 'fatture' }, anno: 2026, p: P(), finoAl: '2026-06-20' } },
    },
    verifiche: [{ valore: r('ricavi'), op: 'uguale', atteso: 700_000 }],
  });
  add({
    id: 'storico/totali-mensili-errori', origine: `${STORICO} › ${dMesi} › errori: nessun movimento generato`,
    funzione: 'storicoDaTotaliMensili',
    input: {
      mesi: [
        { mese: 13, incassi: 100 }, { mese: 3, incassi: 100 }, { mese: 3, incassi: 100 }, { mese: 7, incassi: 100 },
        { mese: 4, incassi: 100, ritenute: 200 }, { mese: 5, incassi: -100 }, { mese: 1, incassi: 100, spese: { benzina: 100 } },
      ],
      opt,
    },
    atteso: {
      fatture: [], spese: [],
      errori: [
        'Mese 13 non valido.', 'Il mese di marzo è inserito due volte.', 'Il mese di luglio 2026 non è ancora iniziato.',
        'Aprile: le ritenute superano gli incassi.', 'Maggio: importo degli incassi non valido.', 'Gennaio: categoria di spesa sconosciuta (benzina).',
      ],
    },
  });
  const dTot = 'Storico — totale da inizio anno';
  add({
    id: 'storico/totale-anno', origine: `${STORICO} › ${dTot} › una sola cifra, datata oggi`,
    funzione: 'storicoDaTotaleAnno', input: { totale: { incassi: 2_000_000, spese: { affitto_studio: 300_000 } }, opt },
    atteso: {
      fatture: [{ id: 'st-2026-totale', dataIncasso: '2026-06-20', imponibile: 2_000_000 }],
      spese: [{ id: 'st-2026-totale-affitto_studio', data: '2026-06-20', importo: 300_000 }],
    },
  });
  add({
    id: 'storico/totale-anno-passato', origine: `${STORICO} › ${dTot} › anno passato: al 31/12; anno futuro: errore`,
    funzione: 'storicoDaTotaleAnno', input: { totale: { incassi: 100 }, opt: { ...opt, anno: 2025 } },
    verifiche: [{ valore: r('fatture[0].dataIncasso'), op: 'uguale', atteso: '2025-12-31' }],
  });
  add({
    id: 'storico/totale-anno-futuro', origine: `${STORICO} › ${dTot} › anno passato: al 31/12; anno futuro: errore`,
    funzione: 'storicoDaTotaleAnno', input: { totale: { incassi: 100 }, opt: { ...opt, anno: 2027 } },
    atteso: { errori: ['Il 2027 non è ancora iniziato.'] },
  });
  const dCsvSt = 'Storico — import CSV';
  const CSV = [
    'data;tipo;importo;categoria;descrizione', '15/01/2026;incasso;150,00;;Visita', '20/01/2026;Incasso;1.234,56;;', '',
    '03/02/2026;incasso;80;;', '05/02/2026;spesa;1.200,00;affitto_studio;Affitto febbraio', '10/02/2026;spesa;45,50;;Cancelleria',
    '31/02/2026;incasso;100;;', '15/03/2025;incasso;100;;', '15/12/2026;incasso;100;;', '15/03/2026;rimborso;100;;',
    '15/03/2026;spesa;abc;altro;', '15/03/2026;spesa;0;altro;', '15/03/2026;spesa;-10,00;altro;', '15/03/2026;spesa;10;benzina;',
    '15/03/2026;spesa;10;altro;x;extra', '15/03/2026;spesa;"10;altro',
  ].join('\r\n');
  add({
    id: 'storico/csv-anteprima', origine: `${STORICO} › ${dCsvSt} › anteprima: movimenti validi, righe scartate con il motivo`,
    funzione: 'anteprimaImportCsv', input: { testo: CSV, opt },
    atteso: {
      errori: [], separatore: ';', righeLette: 15, totaleIncassi: 146_456, totaleSpese: 124_550,
      fatture: [
        { id: 'st-r2', dataIncasso: '2026-01-15', imponibile: 15_000, tipoPrestazione: 'Visita', storico: true },
        { id: 'st-r3', dataIncasso: '2026-01-20', imponibile: 123_456, tipoPrestazione: null, storico: true },
        { id: 'st-r5', dataIncasso: '2026-02-03', imponibile: 8_000, tipoPrestazione: null, storico: true },
      ],
      spese: [
        { id: 'st-r6', categoria: 'affitto_studio', importo: 120_000, descrizione: 'Affitto febbraio', storico: true },
        { id: 'st-r7', categoria: 'altro', importo: 4_550, descrizione: 'Cancelleria', storico: true },
      ],
      scartate: [
        { riga: 8, motivo: 'data non valida: usa gg/mm/aaaa', testo: '31/02/2026;incasso;100;;' },
        { riga: 9, motivo: 'data fuori dal 2026' }, { riga: 10, motivo: 'data futura' },
        { riga: 11, motivo: 'tipo non valido: usa "incasso" o "spesa"' }, { riga: 12, motivo: 'importo non valido' },
        { riga: 13, motivo: 'l\'importo deve essere maggiore di zero' }, { riga: 14, motivo: 'importo non valido' },
        { riga: 15, motivo: 'categoria sconosciuta: benzina' }, { riga: 16, motivo: 'più colonne dell\'intestazione' },
        { riga: 17, motivo: 'virgolette non chiuse' },
      ],
    },
  });
  add({
    id: 'storico/csv-virgola-bom', origine: `${STORICO} › ${dCsvSt} › separatore virgola, BOM UTF-8 e importi tra virgolette`,
    funzione: 'anteprimaImportCsv',
    input: { testo: '﻿Data,Tipo,Importo\n15/01/2026,incasso,"1.234,56"\n16/01/2026,incasso,150,00\n17/01/2026,incasso,"il ""totale"""', opt },
    atteso: {
      separatore: ',',
      fatture: [{ imponibile: 123_456 }],
      scartate: [
        { riga: 3, motivo: 'più colonne dell\'intestazione: con la virgola come separatore metti gli importi tra virgolette' },
        { riga: 4, motivo: 'importo non valido' },
      ],
    },
  });
  const itInt = 'intestazione senza colonne obbligatorie o file vuoto: errore';
  add({
    id: 'storico/csv-intestazione', origine: `${STORICO} › ${dCsvSt} › ${itInt}`, funzione: 'anteprimaImportCsv', input: { testo: 'giorno;importo\n15/01/2026;10', opt },
    atteso: { errori: ['Nell\'intestazione manca la colonna "data", la colonna "tipo". Modello: data;tipo;importo;categoria;descrizione'] },
  });
  add({
    id: 'storico/csv-vuoto', origine: `${STORICO} › ${dCsvSt} › ${itInt}`, funzione: 'anteprimaImportCsv', input: { testo: '\n  \n', opt },
    atteso: { errori: ['Il file è vuoto.'] },
  });
  ([['1/2/2026', '2026-02-01'], ['29/02/2028', '2028-02-29'], ['29/02/2026', null], ['2026-02-01', null], ['15/13/2026', null]] as const)
    .forEach(([testo, atteso], i) => add({
      id: `storico/data-italiana-${i + 1}`, origine: `${STORICO} › ${dCsvSt} › date gg/mm/aaaa`, funzione: 'parseDataItaliana', input: { testo }, atteso,
    }));

  // ───────────────────────── analisi.test.ts ─────────────────────────
  let n = 0;
  const incasso = (dataIncasso: string, imponibile: number, extra: Partial<Fattura> = {}): Fattura => ({
    id: `a${++n}`, numero: String(n), dataFattura: dataIncasso, imponibile, trattamentoIva: 'forfettario_no_iva',
    bolloAddebitato: false, destinatario: 'paziente', elettronica: false, stato: 'incassata', dataIncasso, origine: 'manuale', ...extra,
  });
  const spesa = (data: string, importo: number, categoria: Spesa['categoria']): Spesa => ({ id: `s${++n}`, data, importo, categoria });
  const fattureAn: Fattura[] = [
    incasso('2026-01-10', 100_000), incasso('2026-01-20', 50_000), incasso('2026-02-15', 200_000), incasso('2026-03-01', 70_000),
    incasso('2026-02-20', 999_000, { stato: 'da_incassare', dataIncasso: undefined }),
    incasso('2025-01-10', 100_000), incasso('2025-03-03', 80_000),
  ];
  const speseAn: Spesa[] = [
    spesa('2026-01-05', 30_000, 'affitto_studio'), spesa('2026-03-01', 10_000, 'utenze'), spesa('2026-03-01', 5_000, 'software'),
    spesa('2026-02-28', 50_000, 'contributi_enpam'), spesa('2026-03-01', 70_000, 'imposte_f24'),
  ];
  const dAn = 'Analisi';
  const itSerie = 'serie mensili: incassi per data di incasso, spese professionali per data di pagamento';
  add({
    id: 'analisi/serie-mensili', origine: `${ANALISI} › ${dAn} › ${itSerie}`, funzione: 'serieMensili', input: { fatture: fattureAn, spese: speseAn, anno: 2026, p: P() },
    verifiche: [
      { valore: { $lunghezza: r('') }, op: 'uguale', atteso: 12 },
      { valore: r('[0]'), op: 'uguale', atteso: { mese: 1, incassi: 150_000, spese: 30_000, netto: 120_000 } },
      { valore: r('[1]'), op: 'uguale', atteso: { mese: 2, incassi: 200_000, spese: 0, netto: 200_000 } },
      { valore: r('[2]'), op: 'uguale', atteso: { mese: 3, incassi: 70_000, spese: 15_000, netto: 55_000 } },
      { valore: r('[3]'), op: 'uguale', atteso: { mese: 4, incassi: 0, spese: 0, netto: 0 } },
    ],
  });
  add({
    id: 'analisi/serie-mensili-fino-al', origine: `${ANALISI} › ${dAn} › ${itSerie}`, funzione: 'serieMensili',
    input: { fatture: fattureAn, spese: speseAn, anno: 2026, p: P(), finoAl: '2026-02-28' },
    verifiche: [{ valore: r('[2]'), op: 'uguale', atteso: { mese: 3, incassi: 0, spese: 0, netto: 0 } }],
  });
  const itCat = 'spese per categoria, dalla più alta, senza ENPAM e F24';
  add({
    id: 'analisi/spese-per-categoria', origine: `${ANALISI} › ${dAn} › ${itCat}`, funzione: 'spesePerCategoria', input: { spese: speseAn, anno: 2026 },
    atteso: [
      { categoria: 'affitto_studio', importo: 30_000, quota: 30_000 / 45_000 },
      { categoria: 'utenze', importo: 10_000, quota: 10_000 / 45_000 },
      { categoria: 'software', importo: 5_000, quota: 5_000 / 45_000 },
    ],
  });
  add({ id: 'analisi/spese-per-categoria-vuota', origine: `${ANALISI} › ${dAn} › ${itCat}`, funzione: 'spesePerCategoria', input: { spese: speseAn, anno: 2025 }, atteso: [] });
  add({
    id: 'analisi/confronto', origine: `${ANALISI} › ${dAn} › confronto con lo stesso periodo dell'anno precedente`,
    funzione: 'confrontoAnnoPrecedente', input: { fatture: fattureAn, spese: speseAn, oggi: '2026-03-01' },
    atteso: {
      stessoGiornoAnnoPrecedente: '2025-03-01', totale: { incassi: 420_000, spese: 45_000, netto: 375_000 },
      totalePrecedente: { incassi: 100_000, spese: 0, netto: 100_000 }, variazioneIncassi: 3.2,
    },
    verifiche: [{ valore: r('mesi[2].annoPrecedente.incassi'), op: 'uguale', atteso: 80_000 }],
  });
  add({
    id: 'analisi/confronto-29-febbraio', origine: `${ANALISI} › ${dAn} › confronto: 29 febbraio e anno precedente senza incassi`,
    funzione: 'confrontoAnnoPrecedente', input: { fatture: [], spese: [], oggi: '2028-02-29' },
    atteso: { stessoGiornoAnnoPrecedente: '2027-02-28', variazioneIncassi: null },
  });
  const d1 = SCENARI_DASHBOARD.find((x) => x.id === 'D1');
  if (d1) {
    add({
      id: 'analisi/dove-vanno-100-euro-D1', origine: `${ANALISI} › ${dAn} › dove vanno 100 €: scenario D1 (attesi: scripts/atteso_dashboard.py)`,
      chiamate: {
        riepilogo: {
          funzione: 'calcolaRiepilogo',
          input: {
            input: {
              oggi: d1.input.oggi, profilo: d1.input.profilo, spese: d1.input.spese,
              fatture: d1.input.incassi.map((x, i) => incasso(x.data, x.imponibile, { numero: `D1-${i + 1}` })),
            },
          },
        },
        cento: { funzione: 'doveVanno100Euro', input: { r: da('riepilogo') } },
      },
      verifiche: [{ valore: r('cento'), op: 'uguale', atteso: { spese: 0, imposte: 966, contributi: 1_530, netto: 7_504 } }],
    });
    add({
      id: 'analisi/dove-vanno-100-euro-senza-ricavi', origine: `${ANALISI} › ${dAn} › dove vanno 100 €: senza ricavi non c'è nulla da mostrare`,
      chiamate: {
        riepilogo: { funzione: 'calcolaRiepilogo', input: { input: { oggi: '2026-06-30', profilo: SCENARI_DASHBOARD[0].input.profilo, fatture: [], spese: [] } } },
        cento: { funzione: 'doveVanno100Euro', input: { r: da('riepilogo') } },
      },
      verifiche: [{ valore: r('cento'), op: 'uguale', atteso: null }],
    });
  }

  // ───────────────────────── validazione.test.ts ─────────────────────────
  const fv: Fattura = {
    id: 'f1', numero: '1', dataFattura: '2026-03-10', imponibile: 15_000, trattamentoIva: 'esente_art10',
    bolloAddebitato: true, destinatario: 'paziente', elettronica: false, stato: 'incassata', dataIncasso: '2026-03-10', origine: 'manuale',
  };
  const sv: Spesa = { id: 's1', data: '2026-03-01', importo: 122_000, iva: 22_000, categoria: 'software' };
  const pv: Profilo = {
    regime: 'forfettario', dataNascita: '1990-05-10', annoInizioAttivita: 2020, requisitiStartup5: false,
    rateQuotaA: 1, rateQuotaB: 1, emetteFattureElettroniche: false,
  };
  const oggiV = '2026-06-30';
  ([['2026-02-28', true], ['2028-02-29', true], ['2026-02-29', false], ['2026-13-01', false], ['2026-1-01', false], ['', false]] as const)
    .forEach(([iso, atteso], i) => add({
      id: `validazione/data-iso-${i + 1}`, origine: `${VALIDAZIONE} › Date ISO › ${iso} -> ${atteso}`, funzione: 'dataIsoValida', input: { iso }, atteso,
    }));
  const val = (id: string, origine: string, funzione: string, input: Record<string, unknown>, errori: [string, string][]) => add({
    id: `validazione/${id}`, origine: `${VALIDAZIONE} › ${origine}`, funzione, input,
    atteso: { valido: errori.length === 0, errori: errori.map(([campo, messaggio]) => ({ campo, messaggio })) },
  });
  const vF = 'validaFattura';
  val('fattura-corretta', `${vF} › fattura corretta`, vF, { f: fv, oggi: oggiV }, []);
  val('fattura-errori', `${vF} › errori con il campo e il messaggio per l'interfaccia`, vF,
    { f: { ...fv, numero: ' ', imponibile: 0, iva: 500, bolloAddebitato: true, ritenutaAcconto: -1, dataIncasso: '2026-07-01' }, oggi: oggiV }, [
      ['numero', 'Inserisci il numero della fattura.'],
      ['imponibile', 'L\'importo deve essere maggiore di zero.'],
      ['iva', 'Questa fattura è senza IVA: l\'IVA deve essere zero.'],
      ['ritenutaAcconto', 'Ritenuta non valida.'],
      ['dataIncasso', 'Data di incasso: la data è nel futuro.'],
    ]);
  const itIva = `${vF} › IVA, bollo, ritenuta e stato`;
  val('fattura-bollo-con-iva', itIva, vF, { f: { ...fv, trattamentoIva: 'imponibile_22', iva: 3_300, bolloAddebitato: true } },
    [['bolloAddebitato', 'Il bollo non è dovuto sulle fatture con IVA.']]);
  val('fattura-ritenuta-alta', itIva, vF, { f: { ...fv, ritenutaAcconto: 20_000 } }, [['ritenutaAcconto', 'La ritenuta non può superare l\'imponibile.']]);
  val('fattura-senza-data-incasso', itIva, vF, { f: { ...fv, dataIncasso: undefined } }, [['dataIncasso', 'Inserisci la data di incasso.']]);
  val('fattura-da-incassare-con-data', itIva, vF, { f: { ...fv, stato: 'da_incassare' } }, [['dataIncasso', 'Una fattura da incassare non ha la data di incasso.']]);
  val('fattura-data-e-decimali', itIva, vF, { f: { ...fv, dataFattura: '2026-02-30', imponibile: 10.5 } }, [
    ['dataFattura', 'Data della fattura: data non valida.'],
    ['imponibile', 'L\'importo deve essere maggiore di zero.'],
  ]);
  val('fattura-futura', `${vF} › la data della fattura può essere futura, quella di incasso no`, vF,
    { f: { ...fv, dataFattura: '2026-07-15', stato: 'da_incassare', dataIncasso: undefined }, oggi: oggiV }, []);
  const vS = 'validaSpesa';
  val('spesa-corretta', `${vS} › spesa corretta`, vS, { s: sv, oggi: oggiV }, []);
  const itSp = `${vS} › importo, IVA, categoria, deducibilità, data futura`;
  val('spesa-errori', itSp, vS, { s: { ...sv, importo: -100, iva: 200_000, categoria: 'benzina', deducibilitaPersonalizzata: 1.5, data: '2026-08-01' }, oggi: oggiV }, [
    ['data', 'Data del pagamento: la data è nel futuro.'],
    ['importo', 'L\'importo deve essere maggiore di zero.'],
    ['categoria', 'Scegli una categoria.'],
    ['deducibilitaPersonalizzata', 'La deducibilità deve essere tra 0% e 100%.'],
  ]);
  val('spesa-iva-alta', itSp, vS, { s: { ...sv, iva: 200_000 } }, [['iva', 'L\'IVA non può superare l\'importo pagato.']]);
  const itRif = `${vS} › riferimento dei versamenti F24 ed ENPAM`;
  val('spesa-f24-ok', itRif, vS, { s: { ...sv, categoria: 'imposte_f24', riferimento: { tributo: 'imposta', anno: 2025, tipo: 'saldo' } } }, []);
  val('spesa-riferimento-non-ammesso', itRif, vS, { s: { ...sv, riferimento: { tributo: 'imposta', anno: 2025 } } },
    [['riferimento', 'Il riferimento si indica solo per i versamenti F24 ed ENPAM.']]);
  val('spesa-f24-tributo-anno', itRif, vS, { s: { ...sv, categoria: 'imposte_f24', riferimento: { tributo: 'enpam_quota_a', anno: 2027 } } }, [
    ['riferimento.tributo', 'Per un F24 scegli imposta, addizionale o IVA.'],
    ['riferimento.anno', 'Anno di riferimento non valido.'],
  ]);
  val('spesa-enpam-tipo', itRif, vS, { s: { ...sv, categoria: 'contributi_enpam', riferimento: { tributo: 'enpam_quota_b', anno: 2025, tipo: 'saldo' } } },
    [['riferimento.tipo', 'Saldo o acconto si indicano solo per imposte e addizionali.']]);
  const vP = 'validaProfilo';
  val('profilo-corretto', `${vP} › profilo corretto`, vP, { p: pv, oggi: oggiV }, []);
  val('profilo-errori', `${vP} › errori sui campi`, vP, {
    p: {
      ...pv, dataNascita: '2027-01-01', annoInizioAttivita: 2030, coefficienteRedditivita: 1.2, comuneCodiceCatastale: 'Roma',
      regione: 'XXX', rateQuotaA: 3, rateQuotaB: 4, aliquotaQuotaB: 0.02, redditiLavoroDipendenteAnnoPrecedente: -5,
    },
    oggi: oggiV,
  }, [
    ['dataNascita', 'Data di nascita: la data è nel futuro.'],
    ['annoInizioAttivita', 'Anno di apertura della partita IVA non valido.'],
    ['coefficienteRedditivita', 'Il coefficiente di redditività deve essere tra 0% e 100%.'],
    ['comuneCodiceCatastale', 'Codice del comune non valido: scegli il comune dall\'elenco.'],
    ['regione', 'Scegli la regione dall\'elenco.'],
    ['rateQuotaA', 'Rate della Quota A: 1, 4 o 8.'],
    ['rateQuotaB', 'Rate della Quota B: 1, 2, 5 o 9.'],
    ['aliquotaQuotaB', 'Aliquota della Quota B: 19,5% oppure 9,75%.'],
    ['redditiLavoroDipendenteAnnoPrecedente', 'Importo non valido.'],
  ]);
  const itPrec = `${vP} › dati dell'anno precedente`;
  val('profilo-prec-negativi', itPrec, vP, { p: { ...pv, annoPrecedente: { anno: 2025, impostaDifferenza: -5_000, redditoProfessionale: -100 } }, oggi: oggiV }, []);
  val('profilo-prec-errori', itPrec, vP, { p: { ...pv, annoPrecedente: { anno: 2024, impostaDifferenza: 1.5, ricavi: -1 } }, oggi: oggiV }, [
    ['annoPrecedente.anno', 'I dati dell\'anno precedente devono riguardare il 2025.'],
    ['annoPrecedente.impostaDifferenza', 'Importo non valido.'],
    ['annoPrecedente.ricavi', 'Importo non valido.'],
  ]);

  // ───────────────────────── backup.test.ts ─────────────────────────
  const datiB = {
    profilo: { regime: 'forfettario', dataNascita: '1990-05-10', annoInizioAttivita: 2020, requisitiStartup5: false, rateQuotaA: 1, rateQuotaB: 1, emetteFattureElettroniche: false },
    fatture: [{
      id: 'f1', numero: '1', dataFattura: '2026-03-10', imponibile: 15_000, trattamentoIva: 'forfettario_no_iva', bolloAddebitato: true,
      destinatario: 'paziente', elettronica: false, stato: 'incassata', dataIncasso: '2026-03-10', origine: 'manuale', nomePaziente: 'Mario Rossi',
    }],
    spese: [{ id: 's1', data: '2026-03-01', importo: 80_000, categoria: 'affitto_studio', storico: true }],
  };
  const dB = 'Backup';
  add({
    id: 'backup/semver', origine: `${BACKUP} › Versione del motore › è in formato semver`,
    funzione: 'esportaBackup', input: { dati: { fatture: [], spese: [] }, creatoIl: 'x' },
    verifiche: [{ valore: r(''), op: 'corrisponde', atteso: '"versioneMotore": "\\d+\\.\\d+\\.\\d+"' }],
  });
  add({
    id: 'backup/esporta-reimporta', origine: `${BACKUP} › ${dB} › esporta e reimporta gli stessi dati, con schema, versioni e data passata dall'app`,
    chiamate: {
      testo: { funzione: 'esportaBackup', input: { dati: datiB, creatoIl: '2026-10-13T12:00:00+02:00' } },
      importato: { funzione: 'importaBackup', input: { testo: da('testo') } },
    },
    verifiche: [
      { valore: r('testo'), op: 'corrisponde', atteso: '"schema": "lumiamed-backup"' },
      { valore: r('testo'), op: 'corrisponde', atteso: '"versioneSchema": 1' },
      { valore: r('testo'), op: 'corrisponde', atteso: '"creatoIl": "2026-10-13T12:00:00\\+02:00"' },
      { valore: r('importato.ok'), op: 'uguale', atteso: true },
      { valore: r('importato.dati'), op: 'uguale', atteso: datiB },
      { valore: r('importato.versioneSchema'), op: 'uguale', atteso: 1 },
      { valore: r('importato.creatoIl'), op: 'uguale', atteso: '2026-10-13T12:00:00+02:00' },
    ],
  });
  const fileBackup = (x: Record<string, unknown>) => JSON.stringify({ schema: 'lumiamed-backup', versioneSchema: 1, versioneMotore: '1.0.0', creatoIl: 'x', ...x }, null, 2);
  add({
    id: 'backup/bom-senza-profilo', origine: `${BACKUP} › ${dB} › senza profilo e con il BOM all'inizio`,
    funzione: 'importaBackup', input: { testo: `﻿${fileBackup({ fatture: [], spese: [] })}` },
    atteso: { ok: true, dati: { fatture: [], spese: [], profilo: null } },
  });
  const itNonValidi = 'file non validi';
  ([
    ['non-json', 'non è json', 'Il file non è un backup di LumiaMed (non è un file JSON valido).'],
    ['schema', '{"fatture":[]}', 'Il file non è un backup di LumiaMed.'],
    ['versione-non-valida', JSON.stringify({ schema: 'lumiamed-backup', versioneSchema: 'uno' }), 'Il backup è danneggiato: versione non valida.'],
    ['versione-successiva', JSON.stringify({ schema: 'lumiamed-backup', versioneSchema: 2, fatture: [], spese: [] }), 'Il backup è stato creato con una versione più recente di LumiaMed: aggiorna l\'app e riprova.'],
    ['senza-spese', JSON.stringify({ schema: 'lumiamed-backup', versioneSchema: 1, fatture: [] }), 'Il backup è danneggiato: mancano le fatture o le spese.'],
  ] as const).forEach(([slug, testo, errore]) => add({
    id: `backup/${slug}`, origine: `${BACKUP} › ${dB} › ${itNonValidi}`, funzione: 'importaBackup', input: { testo }, atteso: { ok: false, errori: [errore] },
  }));
  add({
    id: 'backup/validazione', origine: `${BACKUP} › ${dB} › valida ogni movimento e il profilo: con un solo errore non restituisce dati`,
    funzione: 'importaBackup',
    input: {
      testo: fileBackup({
        profilo: { ...datiB.profilo, rateQuotaA: 3 },
        fatture: [datiB.fatture[0], { ...datiB.fatture[0], numero: '2', imponibile: -5 }],
        spese: [datiB.spese[0], { ...datiB.spese[0] }, 'testo', { ...datiB.spese[0], id: '' }],
      }),
    },
    atteso: {
      ok: false,
      errori: [
        'Fattura 2: identificativo ripetuto (f1).',
        'Fattura 2 (n. 2): L\'importo deve essere maggiore di zero.',
        'Spesa 2: identificativo ripetuto (s1).',
        'Spesa 3: dati non validi.',
        'Spesa 4: manca l\'identificativo.',
        'Profilo: Rate della Quota A: 1, 4 o 8.',
      ],
    },
  });
}
