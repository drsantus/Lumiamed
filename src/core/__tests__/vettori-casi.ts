/**
 * VETTORI GOLDEN — tutti i casi dei file *.test.ts e di scenari.ts in forma neutra
 * (funzione, input, output atteso), per verificare un porting del motore (es. Swift).
 *
 * `npm run vettori` scrive golden/vettori.json da qui; vettori.test.ts li esegue sul motore
 * TypeScript e controlla che il JSON sia allineato a questo file.
 *
 * Gli attesi sono trascritti dalle asserzioni dei test o presi da scenari.ts:
 * non vengono MAI calcolati con il motore. Il formato è descritto in docs/PORTING.md.
 */
import { euro } from '../money';
import type { Fattura, Profilo, Spesa } from '../types';
import {
  SCENARI_ACCONTI, SCENARI_DASHBOARD, SCENARI_FORFETTARIO, SCENARI_ORDINARIO, SCENARI_QUOTA_A, SCENARI_QUOTA_B,
} from './scenari';

export type Espr =
  | number | string | boolean | null
  | { $: string }
  | { $parametri: number; campo?: string }
  | { $somma: Espr[] }
  | { $diff: [Espr, Espr] }
  | { $prodotto: Espr[] }
  | { $quoziente: [Espr, Espr] }
  | { $max: Espr[] }
  | { $abs: Espr }
  | { $lunghezza: Espr }
  | { $righe: Espr };

export type Operatore =
  | 'uguale' | 'maggioreDi' | 'minoreDi' | 'minoreOUguale' | 'vicino'
  | 'contiene' | 'nonContiene' | 'corrisponde' | 'jsonNonContiene' | 'ordinato';

export interface Verifica {
  valore: Espr;
  op: Operatore;
  atteso?: Espr;
  /** Solo per 'vicino': come toBeCloseTo di vitest, |valore − atteso| < 10^−cifre / 2. */
  cifre?: number;
}

export interface Chiamata {
  funzione: string;
  /** Argomenti per nome, nell'ordine della firma. Gli argomenti omessi usano il default. */
  input: Record<string, unknown>;
}

export interface Vettore {
  id: string;
  /** File › describe › it da cui viene il caso. */
  origine: string;
  nota?: string;
  /** Forma semplice: una chiamata. */
  funzione?: string;
  input?: Record<string, unknown>;
  /** Confronto parziale sul risultato (vedi docs/PORTING.md). */
  atteso?: unknown;
  /** Forma con più chiamate: i percorsi delle verifiche iniziano con il nome della chiamata. */
  chiamate?: Record<string, Chiamata>;
  verifiche?: Verifica[];
}

export interface FileVettori {
  versione: number;
  descrizione: string;
  convenzioni: Record<string, string>;
  vettori: Vettore[];
}

const P = (anno = 2026, campo?: string) => (campo ? { $parametri: anno, campo } : { $parametri: anno });
const r = (percorso: string): Espr => ({ $: percorso });

const FISCALE = 'fiscale.test.ts';
const OCR = 'ocr.test.ts';
const RIEPILOGO = 'riepilogo.test.ts';
const SCADENZIARIO = 'scadenziario.test.ts';

/** Stessa tabella di prova di fiscale.test.ts. */
const TABELLE_PROVA = {
  regionali: {
    LAZ: {
      regione: 'LAZ', anno: 2026, fonte: 'prova',
      scaglioni: [
        { fino: euro(15_000), aliquota: 0.0173 },
        { fino: euro(28_000), aliquota: 0.0273 },
        { fino: euro(50_000), aliquota: 0.0293 },
        { fino: null, aliquota: 0.0333 },
      ],
    },
  },
  comunali: {
    H501: {
      codiceCatastale: 'H501', comune: 'Roma', provincia: 'RM', anno: 2026,
      aliquotaUnica: 0.008, esenzione: { soglia: euro(10_000), tipo: 'esclusione' },
    },
  },
};

/** Stessi testi di ocr.test.ts. */
const FATTURA_PAZIENTE = `
Dott.ssa Maria Bianchi
Medico Chirurgo - Specialista in Dermatologia
Via Roma 10, 09010 Portoscuso (SU)
P.IVA 01234567890
FATTURA N. 45/2026 del 12/03/2026
Spett.le RSSMRA80A01H501U
Visita dermatologica specialistica      150,00
Operazione esente IVA ai sensi dell'art. 10 n. 18 DPR 633/72
Marca da bollo assolta                    2,00
TOTALE DOCUMENTO € 152,00
`;

const FATTURA_FORFETTARIO = `
Dr. Luca Verdi
Fattura nr. 7 del 03-02-2026
Ecografia addominale
Compenso € 120,00
Operazione effettuata ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014 regime forfettario
Imposta di bollo 2,00
Totale da pagare 122,00
`;

const FATTURA_IVA = `
Fattura 12/A
Data: 15/04/2026
Perizia medico-legale
Imponibile 500,00
IVA 22% 110,00
Totale 610,00
`;

export function costruisciVettori(): FileVettori {
  const vettori: Vettore[] = [];
  const add = (v: Vettore) => vettori.push(v);

  // Stessa fabbrica di riepilogo.test.ts (gli id non influiscono sui risultati verificati).
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

  // ───────────────────────── fiscale.test.ts ─────────────────────────
  const dForf = 'Forfettario — scenari validati dal commercialista';
  for (const s of SCENARI_FORFETTARIO) {
    add({
      id: `forfettario/${s.id}`, origine: `${FISCALE} › ${dForf} › ${s.id}: ${s.descrizione}`,
      funzione: 'calcolaForfettario',
      input: {
        input: {
          anno: s.input.anno, ricavi: s.input.ricavi, contributiVersati: s.input.contributiVersati,
          profilo: { annoInizioAttivita: s.input.annoInizioAttivita, requisitiStartup5: s.input.requisitiStartup5 },
        },
        p: P(),
      },
      atteso: s.atteso,
    });
  }
  const profStartup = { annoInizioAttivita: 2022, requisitiStartup5: true };
  ([[2026, profStartup, 0.05], [2027, profStartup, 0.15], [2026, { ...profStartup, requisitiStartup5: false }, 0.15]] as const)
    .forEach(([anno, profilo, atteso], i) => add({
      id: `forfettario/aliquota-${i + 1}`, origine: `${FISCALE} › ${dForf} › 5% solo nei primi 5 anni e solo con i requisiti`,
      funzione: 'aliquotaForfettario', input: { anno, profilo, p: P() }, atteso,
    }));
  ([[90_000, 'FORF_USCITA_ANNO_PROSSIMO'], [105_000, 'FORF_USCITA_IMMEDIATA'], [80_000, 'FORF_VICINO_LIMITE']] as const)
    .forEach(([ricavi, codice], i) => add({
      id: `forfettario/avvisi-limite-${i + 1}`, origine: `${FISCALE} › ${dForf} › avvisa oltre 85.000 € e oltre 100.000 €`,
      funzione: 'calcolaForfettario',
      input: { input: { anno: 2026, ricavi: euro(ricavi), contributiVersati: 0, profilo: { annoInizioAttivita: 2020, requisitiStartup5: false } }, p: P() },
      verifiche: [{ valore: r('avvisi[*].codice'), op: 'contiene', atteso: codice }],
    }));
  add({
    id: 'forfettario/contributi-eccedenti', origine: `${FISCALE} › ${dForf} › contributi eccedenti il reddito: imponibile zero e avviso`,
    funzione: 'calcolaForfettario',
    input: { input: { anno: 2026, ricavi: euro(5_000), contributiVersati: euro(5_000), profilo: { annoInizioAttivita: 2025, requisitiStartup5: true } }, p: P() },
    atteso: { contributiEccedenti: euro(1_100) },
    verifiche: [{ valore: r('avvisi[*].codice'), op: 'contiene', atteso: 'FORF_CONTRIBUTI_ECCEDENTI' }],
  });

  const dIrpef = 'IRPEF — scaglioni 2026 (23% / 33% / 43%)';
  ([[0, 0], [euro(28_000), euro(6_440)], [euro(40_000), euro(10_400)], [euro(50_000), euro(13_700)], [euro(60_000), euro(18_000)]] as const)
    .forEach(([imponibile, totale]) => add({
      id: `irpef/scaglioni-${imponibile}`, origine: `${FISCALE} › ${dIrpef} › imponibile ${imponibile} -> imposta lorda ${totale}`,
      funzione: 'impostaProgressiva', input: { imponibile, scaglioni: P(2026, 'irpef.scaglioni') }, atteso: { totale },
    }));
  ([[euro(5_000), euro(1_265)], [euro(5_500), euro(1_265)], [euro(20_000), euro(772)], [euro(28_000), euro(500)],
    [euro(35_000), euro(340.91)], [euro(50_000), 0], [euro(60_000), 0]] as const)
    .forEach(([reddito, atteso]) => add({
      id: `irpef/detrazione-${reddito}`, origine: `${FISCALE} › ${dIrpef} › detrazione lavoro autonomo: reddito ${reddito} -> ${atteso}`,
      funzione: 'detrazioneLavoroAutonomo', input: { redditoComplessivo: reddito, p: P() }, atteso,
    }));

  const dOrd = 'Ordinario — scenari validati dal commercialista';
  for (const s of SCENARI_ORDINARIO) {
    const a = s.atteso;
    add({
      id: `ordinario/${s.id}`, origine: `${FISCALE} › ${dOrd} › ${s.id}: ${s.descrizione}`,
      funzione: 'calcolaOrdinario',
      input: {
        input: {
          anno: 2026, compensi: s.input.compensi,
          spese: s.input.spese.map((x, i): Spesa => ({ id: `s${i}`, data: '2026-03-01', ...x })),
          contributiVersati: s.input.contributiVersati, ritenuteSubite: s.input.ritenute,
          profilo: { regione: 'LAZ', comuneCodiceCatastale: 'H501' }, tabelleAddizionali: TABELLE_PROVA,
        },
        p: P(),
      },
      atteso: {
        speseDeducibili: a.speseDeducibili, redditoProfessionale: a.redditoProfessionale, imponibile: a.imponibile,
        impostaLorda: a.impostaLorda, detrazioneLavoroAutonomo: a.detrazioneLavoroAutonomo, impostaNetta: a.impostaNetta,
        addizionaleRegionale: a.addizionaleRegionaleProva, addizionaleComunale: a.addizionaleComunaleProva,
      },
      // Il test confronta `differenza` con impostaNetta attesa − ritenute in input.
      verifiche: [{ valore: r('differenza'), op: 'uguale', atteso: { $diff: [a.impostaNetta, s.input.ritenute] } }],
    });
  }
  add({
    id: 'ordinario/addizionali-senza-irpef', origine: `${FISCALE} › ${dOrd} › senza IRPEF netta le addizionali non sono dovute`,
    funzione: 'calcolaOrdinario',
    input: {
      input: {
        anno: 2026, compensi: euro(5_000), spese: [], contributiVersati: 0, ritenuteSubite: 0,
        profilo: { regione: 'LAZ', comuneCodiceCatastale: 'H501' }, tabelleAddizionali: TABELLE_PROVA,
      },
      p: P(),
    },
    atteso: { impostaNetta: 0, addizionaleRegionale: 0, addizionaleComunale: 0 },
  });
  add({
    id: 'ordinario/limite-formazione-iva-detratta', origine: `${FISCALE} › ${dOrd} › formazione limitata a 10.000 € e IVA detratta esclusa dal costo`,
    funzione: 'speseDeducibili',
    input: {
      spese: [
        { id: '1', data: '2026-01-10', importo: euro(12_000), categoria: 'formazione_ecm' },
        { id: '2', data: '2026-01-10', importo: euro(1_220), iva: euro(220), categoria: 'software' },
      ],
      compensi: euro(50_000), p: P(), percentualeDetrazioneIva: 0.5,
    },
    atteso: { perCategoria: { formazione_ecm: { deducibile: euro(10_000) }, software: { deducibile: euro(1_110) } } },
  });
  add({
    id: 'ordinario/avviso-ammortamento', origine: `${FISCALE} › ${dOrd} › segnala le attrezzature da ammortizzare`,
    funzione: 'speseDeducibili',
    input: {
      spese: [{ id: '1', data: '2026-02-01', importo: euro(3_000), categoria: 'attrezzature', descrizione: 'Ecografo' }],
      compensi: euro(50_000), p: P(),
    },
    verifiche: [{ valore: r('avvisi[0].codice'), op: 'uguale', atteso: 'SPESA_AMMORTAMENTO' }],
  });

  const dAdd = 'Addizionali';
  add({
    id: 'addizionali/regione-non-in-tabella', origine: `${FISCALE} › ${dAdd} › regione non in tabella: aliquota base 1,23% e avviso`,
    funzione: 'addizionaleRegionale',
    input: { imponibile: euro(10_000), regione: 'SAR', tabelle: { regionali: {}, comunali: {} } },
    atteso: { importo: euro(123) },
    verifiche: [{ valore: r('avvisi[0].codice'), op: 'uguale', atteso: 'ADD_REG_NON_TROVATA' }],
  });
  add({
    id: 'addizionali/comunale-esclusione', origine: `${FISCALE} › ${dAdd} › comunale: esclusione sotto soglia e franchigia`,
    funzione: 'addizionaleComunale', input: { imponibile: euro(9_000), codiceCatastale: 'H501', tabelle: TABELLE_PROVA },
    atteso: { importo: 0 },
  });
  add({
    id: 'addizionali/comunale-franchigia', origine: `${FISCALE} › ${dAdd} › comunale: esclusione sotto soglia e franchigia`,
    funzione: 'addizionaleComunale',
    input: {
      imponibile: euro(20_000), codiceCatastale: 'x000',
      tabelle: {
        regionali: {},
        comunali: { X000: { codiceCatastale: 'X000', comune: 'Prova', provincia: 'PR', anno: 2026, aliquotaUnica: 0.008, esenzione: { soglia: euro(10_000), tipo: 'franchigia' } } },
      },
    },
    atteso: { importo: euro(80) },
  });

  for (const s of SCENARI_QUOTA_A) {
    add({
      id: `enpam/quota-a-${s.id}`, origine: `${FISCALE} › ENPAM › Quota A ${s.id}: ${s.descrizione}`,
      funzione: 'quotaA', input: { anno: s.input.anno, dataNascita: s.input.dataNascita, p: P() }, atteso: { totale: s.atteso.totale },
    });
  }
  for (const s of SCENARI_QUOTA_B) {
    add({
      id: `enpam/quota-b-${s.id}`, origine: `${FISCALE} › ENPAM › Quota B ${s.id}: ${s.descrizione}`,
      funzione: 'quotaB',
      input: { annoReddito: s.input.annoReddito, redditoProfessionale: s.input.redditoProfessionale, dataNascita: s.input.dataNascita, p: P() },
      atteso: { soglia: s.atteso.soglia, totale: s.atteso.totale },
    });
  }

  const dAcc = 'Acconti';
  const sommaRate: Verifica = { valore: { $somma: [r('primaRata'), r('secondaRata')] }, op: 'uguale', atteso: r('totale') };
  for (const s of SCENARI_ACCONTI) {
    add({
      id: `acconti/${s.id}`, origine: `${FISCALE} › ${dAcc} › ${s.id}: ${s.descrizione}`,
      funzione: 'pianoAcconti', input: { base: s.input.base, p: P() }, atteso: s.atteso, verifiche: [sommaRate],
    });
  }
  add({
    id: 'acconti/rate-dispari', origine: `${FISCALE} › ${dAcc} › rate dispari: la somma resta esatta`,
    funzione: 'pianoAcconti', input: { base: 143_501, p: P() },
    verifiche: [{ valore: { $somma: [r('primaRata'), r('secondaRata')] }, op: 'uguale', atteso: 143_501 }],
  });
  add({
    id: 'acconti/previsionale-conviene', origine: `${FISCALE} › ${dAcc} › previsionale conviene se quest'anno si guadagna meno`,
    funzione: 'confrontaAcconti', input: { baseStorica: euro(5_000), impostaStimataAnnoCorrente: euro(3_000), p: P() },
    atteso: { risparmioPrevisionale: euro(2_000) },
    verifiche: [{ valore: r('avvisi[0].codice'), op: 'uguale', atteso: 'ACCONTI_PREVISIONALE_CONVIENE' }],
  });
  add({
    id: 'acconti/proiezione-meta-anno', origine: `${FISCALE} › ${dAcc} › proiezione lineare a metà anno`,
    nota: 'Il 2 luglio 2026 è il 183° giorno: il test attende Math.round(1000000 / (183 / 365)).',
    funzione: 'proiezioneAnnua', input: { valoreDaInizioAnno: euro(10_000), oggi: '2026-07-02' },
    atteso: { affidabile: true, valoreAnnuo: Math.round(euro(10_000) / (183 / 365)) },
  });
  add({
    id: 'acconti/proiezione-poco-affidabile', origine: `${FISCALE} › ${dAcc} › proiezione lineare a metà anno`,
    funzione: 'proiezioneAnnua', input: { valoreDaInizioAnno: euro(1_000), oggi: '2026-01-20' },
    atteso: { affidabile: false },
  });

  add({
    id: 'parametri/anno-vicino', origine: `${FISCALE} › Parametri › anno non in tabella: usa il più vicino e lo segnala`,
    funzione: 'getParametri', input: { anno: 2027 },
    atteso: { approssimati: true, parametri: { anno: 2027 } },
    verifiche: [{ valore: r('parametri.irpef.scaglioni'), op: 'uguale', atteso: P(2026, 'irpef.scaglioni') }],
  });

  const dCom = 'Tabella comunale precaricata (dati MEF)';
  add({
    id: 'tabelle/comuni-caricati', origine: `${FISCALE} › ${dCom} › contiene migliaia di comuni`,
    funzione: 'tabelleCaricate', input: {},
    verifiche: [{ valore: r('comuni'), op: 'maggioreDi', atteso: 3000 }],
  });
  ([['A006', 20_000, euro(120), 'Abbadia San Salvatore: 0,6% con esenzione fino a 12.000 €'],
    ['A006', 11_000, 0, 'Abbadia San Salvatore: 0,6% con esenzione fino a 12.000 €'],
    ['A005', 40_000, euro(305.2), 'Abbadia Lariana: scaglioni 0,76% / 0,77% / 0,8% con esenzione 15.000 €']] as const)
    .forEach(([codice, imponibile, importo, it]) => add({
      id: `tabelle/comunale-${codice}-${imponibile}`, origine: `${FISCALE} › ${dCom} › ${it}`,
      funzione: 'addizionaleComunale', input: { imponibile: euro(imponibile), codiceCatastale: codice }, atteso: { importo },
    }));

  const dReg = 'Tabella regionale precaricata (dati MEF 2026)';
  ([['SAR', 40_000, euro(492), 'Sardegna: 1,23% unica'],
    ['LOM', 40_000, euro(596.3), 'Lombardia: progressiva 1,23 / 1,58 / 1,72 / 1,73'],
    ['FVG', 15_000, euro(105), 'Friuli VG: 0,70% su tutto fino a 15.000, poi 1,23% su tutto'],
    ['FVG', 20_000, euro(246), 'Friuli VG: 0,70% su tutto fino a 15.000, poi 1,23% su tutto'],
    ['LAZ', 28_000, euro(484.4), 'Lazio: 1,73% su tutto fino a 28.000; detrazione 60 € tra 28.000 e 30.000'],
    ['LAZ', 29_000, euro(665.7), 'Lazio: 1,73% su tutto fino a 28.000; detrazione 60 € tra 28.000 e 30.000'],
    ['VDA', 15_000, 0, "Valle d'Aosta: esente fino a 15.000, poi 1,23% su tutto"],
    ['VDA', 20_000, euro(246), "Valle d'Aosta: esente fino a 15.000, poi 1,23% su tutto"]] as const)
    .forEach(([regione, imponibile, importo, it]) => add({
      id: `tabelle/regionale-${regione}-${imponibile}`, origine: `${FISCALE} › ${dReg} › ${it}`,
      funzione: 'addizionaleRegionale', input: { imponibile: euro(imponibile), regione }, atteso: { importo },
    }));
  add({
    id: 'tabelle/regioni-caricate', origine: `${FISCALE} › ${dReg} › tutte le 21 regioni/province presenti`,
    funzione: 'tabelleCaricate', input: {}, atteso: { regioni: 21 },
  });

  // ───────────────────────── ocr.test.ts ─────────────────────────
  ([['150,00', 15_000], ['1.234,56', 123_456], ['€ 80', 8_000], ['1,234.56', 123_456], ['12.50', 1_250], ['2.000', 200_000]] as const)
    .forEach(([raw, atteso], i) => add({
      id: `ocr/importo-${i + 1}`, origine: `${OCR} › parseImporto › ${raw} -> ${atteso}`,
      funzione: 'parseImporto', input: { raw }, atteso,
    }));
  const dOcr = 'parseInvoiceText';
  add({
    id: 'ocr/fattura-paziente', origine: `${OCR} › ${dOcr} › fattura a paziente esente con bollo`,
    funzione: 'parseInvoiceText', input: { text: FATTURA_PAZIENTE },
    atteso: {
      numero: { valore: '45/2026' }, dataFattura: { valore: '2026-03-12' }, totale: { valore: 15_200 }, bollo: { valore: true },
      trattamentoIva: { valore: 'esente_art10' }, imponibile: { valore: 15_000 }, contieneCodiceFiscale: true,
    },
    verifiche: [
      { valore: r('tipoPrestazione.valore'), op: 'corrisponde', atteso: 'Visita dermatologica' },
      { valore: r(''), op: 'jsonNonContiene', atteso: 'RSSMRA80A01H501U' },
    ],
  });
  add({
    id: 'ocr/fattura-forfettario', origine: `${OCR} › ${dOcr} › fattura forfettario`,
    funzione: 'parseInvoiceText', input: { text: FATTURA_FORFETTARIO },
    atteso: {
      numero: { valore: '7' }, dataFattura: { valore: '2026-02-03' }, imponibile: { valore: 12_000 }, totale: { valore: 12_200 },
      trattamentoIva: { valore: 'forfettario_no_iva' },
    },
  });
  add({
    id: 'ocr/fattura-iva', origine: `${OCR} › ${dOcr} › fattura con IVA 22%`,
    funzione: 'parseInvoiceText', input: { text: FATTURA_IVA },
    atteso: {
      numero: { valore: '12/A' }, dataFattura: { valore: '2026-04-15' }, imponibile: { valore: 50_000 }, totale: { valore: 61_000 },
      trattamentoIva: { valore: 'imponibile_22' }, bollo: { valore: false },
    },
  });
  add({
    id: 'ocr/testo-illeggibile', origine: `${OCR} › ${dOcr} › testo illeggibile: nessun crash e avvisi`,
    funzione: 'parseInvoiceText', input: { text: '@@@ ### ...' },
    atteso: { totale: null },
    verifiche: [{ valore: { $lunghezza: r('avvisi') }, op: 'maggioreDi', atteso: 0 }],
  });

  // ───────────────────────── riepilogo.test.ts ─────────────────────────
  const dMov = 'Movimenti';
  ([[77.47, 'esente_art10', false], [77.48, 'esente_art10', true], [500, 'imponibile_22', false]] as const)
    .forEach(([imponibile, trattamentoIva, atteso], i) => add({
      id: `movimenti/bollo-${i + 1}`, origine: `${RIEPILOGO} › ${dMov} › bollo dovuto solo sopra 77,47 € e senza IVA`,
      funzione: 'bolloDovuto', input: { f: { imponibile: euro(imponibile), trattamentoIva }, p: P() }, atteso,
    }));
  add({
    id: 'movimenti/principio-di-cassa', origine: `${RIEPILOGO} › ${dMov} › principio di cassa: conta la data di incasso, non della fattura`,
    funzione: 'ricaviAnno',
    input: {
      fatture: [
        fattura({ dataFattura: '2025-12-20', dataIncasso: '2026-01-10', imponibile: euro(200) }),
        fattura({ dataFattura: '2026-12-20', stato: 'da_incassare', dataIncasso: undefined, imponibile: euro(300) }),
      ],
      anno: 2026, p: P(),
    },
    atteso: euro(200),
  });
  add({
    id: 'movimenti/netto-incassato', origine: `${RIEPILOGO} › ${dMov} › netto incassato toglie la ritenuta`,
    funzione: 'nettoIncassato',
    input: {
      f: fattura({ trattamentoIva: 'esente_art10', bolloAddebitato: false, imponibile: euro(1_000), ritenutaAcconto: euro(200), destinatario: 'struttura' }),
      p: P(),
    },
    atteso: euro(800),
  });
  add({
    id: 'movimenti/crediti-aperti', origine: `${RIEPILOGO} › ${dMov} › crediti aperti ordinati dal più vecchio`,
    funzione: 'creditiAperti',
    input: {
      fatture: [
        fattura({ dataFattura: '2026-05-01', stato: 'da_incassare', dataIncasso: undefined }),
        fattura({ dataFattura: '2026-02-01', stato: 'da_incassare', dataIncasso: undefined }),
      ],
      oggi: '2026-06-01', p: P(),
    },
    verifiche: [{ valore: r('[*].giorni'), op: 'uguale', atteso: [120, 31] as unknown as Espr }],
  });

  const dIva = 'IVA ordinario';
  const fattureIva = [
    fattura({ trattamentoIva: 'esente_art10', imponibile: euro(8_000), dataFattura: '2026-02-10' }),
    fattura({ trattamentoIva: 'imponibile_22', imponibile: euro(2_000), dataFattura: '2026-03-10', bolloAddebitato: false }),
  ];
  const speseIva: Spesa[] = [{ id: 's1', data: '2026-03-01', importo: euro(610), iva: euro(110), categoria: 'software' }];
  ([[fattureIva, 0.2], [[fattureIva[0]], 0], [[fattureIva[1]], 1]] as const).forEach(([fatture, atteso], i) => add({
    id: `iva/pro-rata-${i + 1}`, origine: `${RIEPILOGO} › ${dIva} › pro-rata arrotondato all'unità superiore`,
    funzione: 'proRata', input: { fatture, anno: 2026 }, atteso,
  }));
  add({
    id: 'iva/liquidazione-t1', origine: `${RIEPILOGO} › ${dIva} › liquidazione 1° trimestre con interessi 1%`,
    funzione: 'liquidazioniIva', input: { fatture: fattureIva, spese: speseIva, anno: 2026, p: P() },
    verifiche: [
      { valore: r('trimestri[0].ivaDebito'), op: 'uguale', atteso: euro(440) },
      { valore: r('trimestri[0].ivaCredito'), op: 'uguale', atteso: euro(22) },
      { valore: r('trimestri[0].interessi'), op: 'uguale', atteso: euro(4.18) },
      { valore: r('trimestri[0].daVersare'), op: 'uguale', atteso: euro(422.18) },
    ],
  });

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
  const inputRiep = {
    input: {
      oggi: '2026-06-30',
      profilo: { ...profiloForf, annoPrecedente: { anno: 2025, impostaDifferenza: euro(1_000), accontiVersati: euro(800), redditoProfessionale: euro(20_000) } },
      fatture: fattureRiep, spese: speseRiep,
    },
  };
  const riep = (slug: string, it: string, v: Pick<Vettore, 'atteso' | 'verifiche'>) => add({
    id: `riepilogo/${slug}`, origine: `${RIEPILOGO} › ${dRiep} › ${it}`, funzione: 'calcolaRiepilogo', input: inputRiep, ...v,
  });
  riep('ricavi', 'ricavi solo incassati fino a oggi', {
    atteso: { ricavi: euro(20_000), speseProfessionali: euro(1_200), contributiVersati: euro(592.94) },
  });
  riep('imposta-forfettaria', 'imposta forfettaria da inizio anno', { atteso: { daInizioAnno: { imposte: euro(750.35) } } });
  riep('quota-b-maturata', 'Quota B maturata: soglia in proporzione ai giorni trascorsi', {
    atteso: { quotaBMaturata: { soglia: euro(2_701), totale: euro(2_515.31) } },
  });
  riep('da-accantonare', 'da accantonare = imposte nette + Quota A residua + Quota B maturata + IVA', {
    atteso: { quotaA: { totale: euro(950.94) }, accantonamento: { quotaAResidua: euro(358), metodo: 'proiezione' } },
    verifiche: [
      {
        valore: r('accantonamento.imposte'), op: 'uguale',
        atteso: { $diff: [{ $diff: [r('accantonamento.imposteMaturate'), r('accantonamento.ritenute')] }, r('accantonamento.accontiVersati')] },
      },
      {
        valore: r('daAccantonare'), op: 'uguale',
        atteso: { $somma: [r('accantonamento.imposte'), r('accantonamento.quotaAResidua'), r('accantonamento.quotaBMaturata'), r('accantonamento.iva')] },
      },
      { valore: r('avvisi[*].codice'), op: 'contiene', atteso: 'VERSAMENTI_DEDOTTI' },
    ],
  });
  riep('impegni-anno-precedente', 'impegni dell\'anno scorso: saldo 200 + Quota B 2025 su 20.000 € (2.837,88)', {
    atteso: { impegniAnnoPrecedente: { anno: 2025, saldoImposte: euro(200), saldoAddizionali: 0, quotaB: euro(2_837.88), totale: euro(3_037.88) } },
    verifiche: [{ valore: r('liquiditaImpegnata'), op: 'uguale', atteso: { $somma: [r('daAccantonare'), euro(3_037.88)] } }],
  });
  riep('percentuale-limite', 'percentuale verso il limite forfettario', {
    verifiche: [{ valore: r('percentualeLimiteForfettario'), op: 'vicino', atteso: { $quoziente: [20_000, 85_000] }, cifre: 6 }],
  });
  riep('scadenze-importi', 'scadenze con importi stimati e saldo', {
    verifiche: [
      { valore: r('scadenze[id=saldo-primo-acconto].importoStimato'), op: 'uguale', atteso: euro(700) },
      { valore: r('scadenze[id=secondo-acconto].importoStimato'), op: 'uguale', atteso: euro(500) },
    ],
  });
  riep('avvisi-sts', 'avvisi: fatture 2025 non inviate al Sistema TS', {
    verifiche: [
      { valore: r('avvisi[*].codice'), op: 'contiene', atteso: 'STS_DA_INVIARE' },
      { valore: { $lunghezza: r('crediti') }, op: 'uguale', atteso: 1 },
      { valore: { $lunghezza: r('parametriDaVerificare') }, op: 'maggioreDi', atteso: 0 },
    ],
  });
  add({
    id: 'riepilogo/ordinario-iva-addizionali', origine: `${RIEPILOGO} › ${dRiep} › ordinario: calcola anche IVA e addizionali`,
    funzione: 'calcolaRiepilogo',
    input: {
      input: {
        oggi: '2026-06-30',
        profilo: { ...profiloForf, regime: 'ordinario', regione: 'SAR' },
        fatture: [fattura({ trattamentoIva: 'esente_art10', imponibile: euro(30_000), dataIncasso: '2026-03-01' })],
        spese: speseRiep,
      },
    },
    atteso: { daInizioAnno: { regime: 'ordinario' }, iva: { soloEsenti: true } },
    verifiche: [{ valore: r('scadenze[*].categoria'), op: 'nonContiene', atteso: 'iva' }],
  });

  ([['free', 'fattura', 29, true], ['free', 'fattura', 30, false], ['pro', 'fattura', 10_000, true]] as const)
    .forEach(([piano, tipo, usatiNelMese, consentito], i) => add({
      id: `piani/limite-${i + 1}`, origine: `${RIEPILOGO} › Piani › limiti e funzioni`,
      funzione: 'puoAggiungere', input: { piano, tipo, usatiNelMese }, atteso: { consentito },
    }));
  ([['free', 'report_pdf', false], ['pro', 'lettura_foto', true]] as const)
    .forEach(([piano, funzione, atteso], i) => add({
      id: `piani/funzione-${i + 1}`, origine: `${RIEPILOGO} › Piani › limiti e funzioni`,
      funzione: 'puoUsare', input: { piano, funzione }, atteso,
    }));

  const dCsv = 'Report CSV';
  const fattureCsv = [fattura({ numero: '1', nomePaziente: 'Mario Rossi', tipoPrestazione: 'Visita; controllo', imponibile: euro(150) })];
  add({
    id: 'report/csv-fatture', origine: `${RIEPILOGO} › ${dCsv} › formato italiano, nome paziente escluso di default`,
    funzione: 'csvFatture', input: { fatture: fattureCsv, anno: 2026, p: P() },
    verifiche: [
      { valore: r(''), op: 'corrisponde', atteso: '^[^\\n]*Numero;Data fattura' },
      { valore: r(''), op: 'contiene', atteso: '150,00' },
      { valore: r(''), op: 'contiene', atteso: '"Visita; controllo"' },
      { valore: r(''), op: 'nonContiene', atteso: 'Mario Rossi' },
    ],
  });
  add({
    id: 'report/csv-fatture-con-paziente', origine: `${RIEPILOGO} › ${dCsv} › formato italiano, nome paziente escluso di default`,
    funzione: 'csvFatture', input: { fatture: fattureCsv, anno: 2026, p: P(), opt: { includiNomePaziente: true } },
    verifiche: [{ valore: r(''), op: 'contiene', atteso: 'Mario Rossi' }],
  });
  add({
    id: 'report/csv-spese', origine: `${RIEPILOGO} › ${dCsv} › spese`,
    funzione: 'csvSpese', input: { spese: [{ id: '1', data: '2026-01-02', importo: euro(10), categoria: 'altro' }], anno: 2026 },
    verifiche: [{ valore: { $righe: r('') }, op: 'uguale', atteso: 2 }],
  });

  for (const sc of SCENARI_DASHBOARD) {
    const fatture = sc.input.incassi.map((x, i) => fattura({
      numero: `${sc.id}-${i + 1}`, dataFattura: x.data, dataIncasso: x.data, imponibile: x.imponibile,
      trattamentoIva: x.trattamentoIva, destinatario: x.destinatario, ritenutaAcconto: x.ritenuta, bolloAddebitato: false,
    }));
    const a = sc.atteso;
    add({
      id: `dashboard/${sc.id}`, origine: `${RIEPILOGO} › Dashboard — scenari per il commercialista › ${sc.id}: ${sc.descrizione}`,
      funzione: 'calcolaRiepilogo',
      input: { input: { oggi: sc.input.oggi, profilo: sc.input.profilo, fatture, spese: sc.input.spese } },
      atteso: {
        accantonamento: { metodo: a.metodo, imposteMaturate: a.imposteMaturate, imposte: a.imposte, quotaAResidua: a.quotaAResidua, quotaBMaturata: a.quotaBMaturata, iva: a.iva },
        daAccantonare: a.daAccantonare,
        impegniAnnoPrecedente: a.impegniAnnoPrecedente === undefined ? null : { totale: a.impegniAnnoPrecedente },
        guadagnoNetto: a.guadagnoNetto,
      },
    });
  }

  const dCorr = 'Correzioni del 13/10 sui numeri della dashboard';
  const ord: Profilo = { ...profiloForf, regime: 'ordinario', dataNascita: '1980-01-01', regione: 'SAR' };
  const mensili = (annuo: number, extra: Partial<Fattura> = {}) => Array.from({ length: 12 }, (_, i) => {
    const d = `2026-${String(i + 1).padStart(2, '0')}-15`;
    return fattura({ imponibile: euro(annuo / 12), dataFattura: d, dataIncasso: d, trattamentoIva: 'esente_art10', bolloAddebitato: false, ...extra });
  });
  const riepilogo = (input: Record<string, unknown>): Chiamata => ({ funzione: 'calcolaRiepilogo', input: { input } });

  const fatt90 = mensili(90_000);
  add({
    id: 'correzioni/imposte-maturate-ordinario', origine: `${RIEPILOGO} › ${dCorr} › ordinario: le imposte maturate seguono l'imposta annua, non gli scaglioni sul reddito parziale`,
    chiamate: {
      fine: riepilogo({ oggi: '2026-12-31', profilo: ord, fatture: fatt90, spese: [] }),
      marzo: riepilogo({ oggi: '2026-03-31', profilo: ord, fatture: fatt90, spese: [] }),
    },
    verifiche: [{
      valore: {
        $abs: {
          $diff: [{
            $quoziente: [
              r('marzo.accantonamento.imposteMaturate'),
              { $prodotto: [r('fine.accantonamento.imposteMaturate'), { $quoziente: [r('marzo.ricavi'), r('fine.ricavi')] }] },
            ],
          }, 1],
        },
      },
      op: 'minoreDi', atteso: 0.02,
    }],
  });
  add({
    id: 'correzioni/ritenute', origine: `${RIEPILOGO} › ${dCorr} › ritenute subite tolte dal da accantonare`,
    funzione: 'calcolaRiepilogo',
    input: {
      input: {
        oggi: '2026-06-30', profilo: ord, spese: [],
        fatture: [fattura({ imponibile: euro(30_000), trattamentoIva: 'esente_art10', bolloAddebitato: false, destinatario: 'struttura', ritenutaAcconto: euro(6_000), dataFattura: '2026-06-01', dataIncasso: '2026-06-01' })],
      },
    },
    atteso: { accantonamento: { ritenute: euro(6_000) } },
    verifiche: [{
      valore: r('accantonamento.imposte'), op: 'uguale',
      atteso: { $max: [0, { $diff: [r('accantonamento.imposteMaturate'), euro(6_000)] }] },
    }],
  });
  const profNo5: Profilo = { ...profiloForf, requisitiStartup5: false };
  const fatt60 = mensili(60_000, { trattamentoIva: 'forfettario_no_iva' });
  add({
    id: 'correzioni/acconti-versati', origine: `${RIEPILOGO} › ${dCorr} › acconti F24 già versati tolti dal da accantonare`,
    chiamate: {
      senza: riepilogo({ oggi: '2026-12-01', profilo: profNo5, fatture: fatt60, spese: [] }),
      con: riepilogo({
        oggi: '2026-12-01', profilo: profNo5, fatture: fatt60,
        spese: [{ id: 'f24', data: '2026-11-30', importo: euro(3_000), categoria: 'imposte_f24', riferimento: { tributo: 'imposta', anno: 2026, tipo: 'acconto' } }],
      }),
    },
    verifiche: [{ valore: { $diff: [r('senza.daAccantonare'), r('con.daAccantonare')] }, op: 'uguale', atteso: euro(3_000) }],
  });
  const maggio = { bolloAddebitato: false, dataFattura: '2026-05-01', dataIncasso: '2026-05-01' } as const;
  add({
    id: 'correzioni/iva-22', origine: `${RIEPILOGO} › ${dCorr} › IVA 22%: il netto non sottrae l'IVA, il da accantonare la include`,
    chiamate: {
      esente: riepilogo({ oggi: '2026-06-30', profilo: ord, spese: [], fatture: [fattura({ imponibile: euro(12_000), trattamentoIva: 'esente_art10', ...maggio })] }),
      conIva: riepilogo({ oggi: '2026-06-30', profilo: ord, spese: [], fatture: [fattura({ imponibile: euro(12_000), trattamentoIva: 'imponibile_22', ...maggio })] }),
    },
    verifiche: [
      { valore: r('conIva.guadagnoNetto'), op: 'uguale', atteso: r('esente.guadagnoNetto') },
      { valore: r('conIva.accantonamento.iva'), op: 'uguale', atteso: euro(2_666.4) },
      { valore: { $diff: [r('conIva.daAccantonare'), r('esente.daAccantonare')] }, op: 'uguale', atteso: euro(2_666.4) },
    ],
  });
  const profQb: Profilo = { ...profiloForf, requisitiStartup5: false, dataNascita: '1980-01-01', annoPrecedente: { anno: 2025, impostaDifferenza: euro(8_000), redditoProfessionale: euro(70_000) } };
  const fatt90f = mensili(90_000, { trattamentoIva: 'forfettario_no_iva' });
  add({
    id: 'correzioni/quota-b-deducibile', origine: `${RIEPILOGO} › ${dCorr} › proiezione: la Quota B dell'anno scorso che scade entro dicembre è deducibile`,
    nota: 'Il test attende una differenza di 1.168.844 × 2/3 × 15% centesimi, con tolleranza di 1 centesimo.',
    chiamate: {
      unica: riepilogo({ oggi: '2026-06-30', profilo: profQb, fatture: fatt90f, spese: [] }),
      noveRate: riepilogo({ oggi: '2026-06-30', profilo: { ...profQb, rateQuotaB: 9 }, fatture: fatt90f, spese: [] }),
    },
    verifiche: [{
      valore: {
        $abs: {
          $diff: [
            { $diff: [r('noveRate.proiezione.imposte'), r('unica.proiezione.imposte')] },
            { $prodotto: [euro(11_688.44), { $quoziente: [2, 3] }, 0.15] },
          ],
        },
      },
      op: 'minoreOUguale', atteso: 1,
    }],
  });
  add({
    id: 'correzioni/quota-a-con-rate-quota-b', origine: `${RIEPILOGO} › ${dCorr} › Quota A non sparisce quando a gennaio-marzo si pagano rate di Quota B`,
    funzione: 'calcolaRiepilogo',
    input: {
      input: {
        oggi: '2026-04-15', profilo: { ...profiloForf, rateQuotaB: 9 }, fatture: fatt60,
        spese: ['01', '02', '03'].map((m): Spesa => ({ id: m, data: `2026-${m}-28`, importo: euro(1_000), categoria: 'contributi_enpam' })),
      },
    },
    verifiche: [{ valore: r('accantonamento.quotaAResidua'), op: 'uguale', atteso: r('quotaA.totale') }],
  });
  add({
    id: 'correzioni/saldo-addizionali', origine: `${RIEPILOGO} › ${dCorr} › ordinario: la scadenza di luglio include il saldo delle addizionali`,
    funzione: 'calcolaRiepilogo',
    input: {
      input: {
        oggi: '2026-06-01', spese: [], fatture: mensili(70_000),
        profilo: {
          ...ord,
          annoPrecedente: { anno: 2025, impostaDifferenza: euro(15_000), accontiVersati: euro(12_000), addizionaleRegionale: euro(760), addizionaleComunale: euro(500), redditoProfessionale: euro(70_000) },
        },
      },
    },
    atteso: { impegniAnnoPrecedente: { saldoAddizionali: euro(1_110) } },
    verifiche: [{ valore: r('scadenze[id=saldo-primo-acconto].importoStimato'), op: 'uguale', atteso: euro(11_760) }],
  });
  add({
    id: 'correzioni/forfettario-5-15', origine: `${RIEPILOGO} › ${dCorr} › forfettario: passaggio dal 5% al 15% riproporziona l'aliquota dell'anno scorso`,
    funzione: 'calcolaRiepilogo',
    input: {
      input: {
        oggi: '2026-02-10', spese: [],
        profilo: { ...profiloForf, annoInizioAttivita: 2021, requisitiStartup5: true, annoPrecedente: { anno: 2025, impostaDifferenza: euro(2_000), ricavi: euro(50_000) } },
        fatture: [fattura({ imponibile: euro(10_000), dataIncasso: '2026-01-20' })],
      },
    },
    atteso: { accantonamento: { metodo: 'anno_precedente', imposteMaturate: euro(1_200) } },
  });

  const dVers = 'Attribuzione dei versamenti senza riferimento';
  const vers = (slug: string, it: string, input: Record<string, unknown>, v: Pick<Vettore, 'atteso' | 'verifiche'>) => add({
    id: `versamenti/${slug}`, origine: `${RIEPILOGO} › ${dVers} › ${it}`, funzione: 'attribuisciVersamenti', input, ...v,
  });
  vers('f24-luglio', 'F24 di luglio: prima il saldo dell\'anno scorso, poi il primo acconto', {
    spese: [{ id: 'a', data: '2026-07-20', importo: euro(3_000), categoria: 'imposte_f24' }],
    opt: { anno: 2026, oggi: '2026-12-31', quotaAAnnua: 0, saldoImposteAnnoPrecedente: euro(2_000) },
  }, {
    atteso: {
      versamenti: [
        { riferimento: { anno: 2025, tipo: 'saldo' }, importo: euro(2_000) },
        { riferimento: { anno: 2026, tipo: 'acconto' }, importo: euro(1_000) },
      ],
    },
  });
  vers('enpam-da-aprile', 'ENPAM da aprile: prima la Quota A fino al suo importo, il resto è Quota B', {
    spese: [{ id: 'a', data: '2026-10-31', importo: euro(5_000), categoria: 'contributi_enpam' }],
    opt: { anno: 2026, oggi: '2026-12-31', quotaAAnnua: euro(2_000) },
  }, {
    atteso: {
      versamenti: [
        { riferimento: { tributo: 'enpam_quota_a', anno: 2026 }, importo: euro(2_000) },
        { riferimento: { tributo: 'enpam_quota_b', anno: 2025 }, importo: euro(3_000) },
      ],
    },
  });
  vers('f24-marzo', 'F24 di marzo senza riferimento: non attribuito, con avviso', {
    spese: [{ id: 'a', data: '2026-03-16', importo: euro(500), categoria: 'imposte_f24' }],
    opt: { anno: 2026, oggi: '2026-12-31', quotaAAnnua: 0 },
  }, {
    atteso: { versamenti: [] },
    verifiche: [{ valore: r('avvisi[*].codice'), op: 'contiene', atteso: 'VERSAMENTI_NON_ATTRIBUITI' }],
  });
  vers('riferimento-utente', 'il riferimento indicato dall\'utente vince sulla data', {
    spese: [{ id: 'a', data: '2026-07-20', importo: euro(800), categoria: 'imposte_f24', riferimento: { tributo: 'iva', anno: 2026 } }],
    opt: { anno: 2026, oggi: '2026-12-31', quotaAAnnua: 0, saldoImposteAnnoPrecedente: euro(2_000) },
  }, {
    atteso: { avvisi: [] },
    verifiche: [
      { valore: r('versamenti[0].importo'), op: 'uguale', atteso: euro(800) },
      { valore: r('versamenti[0].dedotto'), op: 'uguale', atteso: false },
      { valore: r('versamenti[0].riferimento.tributo'), op: 'uguale', atteso: 'iva' },
    ],
  });
  const enpam = (id: string, data: string, importo: number): Spesa => ({ id, data, importo: euro(importo), categoria: 'contributi_enpam' });
  vers('quota-a-4-rate', 'Quota A in 4 rate: la rata di Quota B di ottobre non copre l\'ultima rata di Quota A', {
    spese: [enpam('a1', '2026-04-30', 514.27), enpam('a2', '2026-06-30', 514.27), enpam('a3', '2026-09-30', 514.27), enpam('b1', '2026-10-31', 5_103.22)],
    opt: { anno: 2026, oggi: '2026-10-31', quotaAAnnua: euro(2_057.1), rateQuotaA: 4, rateQuotaB: 2 },
  }, {
    verifiche: [{
      valore: r('versamenti[spesaId~=^b1$]'), op: 'uguale',
      atteso: [{ riferimento: { tributo: 'enpam_quota_b' }, importo: euro(5_103.22) }] as unknown as Espr,
    }],
  });
  const qa = (id: string, data: string): Spesa => ({ id, data, importo: euro(2_057.1), categoria: 'contributi_enpam' });
  vers('enpam-eccedente', 'ENPAM a luglio oltre la Quota A (pagata due volte): eccedenza non attribuita, con avviso', {
    spese: [qa('a', '2026-04-30'), qa('b', '2026-07-15')],
    opt: { anno: 2026, oggi: '2026-07-31', quotaAAnnua: euro(2_057.1) },
  }, {
    atteso: { versamenti: [{ spesaId: 'a', riferimento: { tributo: 'enpam_quota_a' }, importo: euro(2_057.1) }] },
    verifiche: [{ valore: r('avvisi[*].codice'), op: 'contiene', atteso: 'VERSAMENTI_ENPAM_ECCEDENTI' }],
  });
  vers('f24-agosto-iva', 'F24 di agosto nell\'ordinario con IVA: prima l\'IVA del 2° trimestre, poi le imposte', {
    spese: [{ id: 'a', data: '2026-08-20', importo: euro(3_000), categoria: 'imposte_f24' }],
    opt: { anno: 2026, oggi: '2026-08-31', quotaAAnnua: 0, ivaTrimestri: { 2: euro(2_666.4) } },
  }, {
    atteso: {
      versamenti: [
        { riferimento: { tributo: 'iva', tipo: null }, importo: euro(2_666.4) },
        { riferimento: { tributo: 'imposta', tipo: 'acconto' }, importo: euro(333.6) },
      ],
    },
  });

  // ───────────────────────── scadenziario.test.ts ─────────────────────────
  const dCal = 'Calendario';
  ([[2025, '2025-04-20'], [2026, '2026-04-05'], [2027, '2027-03-28']] as const).forEach(([year, atteso]) => add({
    id: `calendario/pasqua-${year}`, origine: `${SCADENZIARIO} › ${dCal} › Pasqua`, funzione: 'easterSunday', input: { year }, atteso,
  }));
  ([['2026-01-31', '2026-02-02'], ['2026-10-31', '2026-11-02'], ['2026-04-06', '2026-04-07'], ['2026-07-20', '2026-07-20']] as const)
    .forEach(([iso, atteso]) => add({
      id: `calendario/lavorativo-${iso}`, origine: `${SCADENZIARIO} › ${dCal} › slittamento al primo giorno lavorativo`,
      funzione: 'primoGiornoLavorativo', input: { iso }, atteso,
    }));
  ([['2026-03-14', 29], ['2026-03-15', 30]] as const).forEach(([al, atteso]) => add({
    id: `calendario/eta-${al}`, origine: `${SCADENZIARIO} › ${dCal} › età compiuta`,
    funzione: 'etaAl', input: { dataNascita: '1996-03-15', al }, atteso,
  }));

  const dSca = 'Scadenziario 2026';
  const base = { rateQuotaA: 1, rateQuotaB: 1, emetteFattureElettroniche: false } as const;
  const data = (id: string, atteso: string): Verifica => ({ valore: r(`[id=${id}].data`), op: 'uguale', atteso });
  add({
    id: 'scadenziario/forfettario-unica-soluzione', origine: `${SCADENZIARIO} › ${dSca} › forfettario con Quota A e B in unica soluzione`,
    funzione: 'generaScadenziario',
    input: { opt: { anno: 2026, profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false }, p: P() },
    verifiche: [
      data('sts', '2026-02-02'), data('quotaA-1', '2026-04-30'), data('modelloD', '2026-07-31'),
      data('saldo-primo-acconto', '2026-07-20'), data('quotaB-1', '2026-11-02'), data('secondo-acconto', '2026-11-30'),
      { valore: r('[*].categoria'), op: 'nonContiene', atteso: 'iva' },
      { valore: r('[*].data'), op: 'ordinato' },
    ],
  });
  add({
    id: 'scadenziario/rate-senza-perdere-centesimi', origine: `${SCADENZIARIO} › ${dSca} › rate Quota A e B con importi divisi senza perdere centesimi`,
    funzione: 'generaScadenziario',
    input: {
      opt: {
        anno: 2026, profilo: { regime: 'forfettario', rateQuotaA: 8, rateQuotaB: 9, emetteFattureElettroniche: false }, haOperazioniIva: false,
        importi: { quotaA: euro(592.94), quotaB: euro(5_021.88), quotaBCicloPrecedente: euro(4_500) },
      },
      p: P(),
    },
    verifiche: [
      { valore: { $lunghezza: r('[id~=^quotaA-]') }, op: 'uguale', atteso: 8 },
      { valore: { $somma: [r('[id~=^quotaA-].importoStimato')] }, op: 'uguale', atteso: euro(592.94) },
      { valore: { $lunghezza: r('[id~=^quotaB-(?!prec)]') }, op: 'uguale', atteso: 3 },
      { valore: { $lunghezza: r('[id~=^quotaB-prec]') }, op: 'uguale', atteso: 6 },
    ],
  });
  add({
    id: 'scadenziario/ordinario-iva-fatture-elettroniche', origine: `${SCADENZIARIO} › ${dSca} › ordinario con IVA e fatture elettroniche`,
    funzione: 'generaScadenziario',
    input: { opt: { anno: 2026, profilo: { regime: 'ordinario', ...base, emetteFattureElettroniche: true }, haOperazioniIva: true }, p: P() },
    verifiche: [data('iva-t1', '2026-05-18'), data('iva-t2', '2026-08-20'), data('iva-acconto', '2026-12-28'), data('bollo-t1', '2026-06-01')],
  });
  add({
    id: 'scadenziario/anno-senza-parametri', origine: `${SCADENZIARIO} › ${dSca} › anno senza parametri: date standard`,
    funzione: 'generaScadenziario',
    input: { opt: { anno: 2027, profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false }, p: P(2027) },
    verifiche: [{ valore: r('[id=saldo-primo-acconto].dataNominale'), op: 'uguale', atteso: '2027-06-30' }],
  });

  return {
    versione: 1,
    descrizione: 'Vettori golden del motore LumiaMed: ogni caso dei test di src/core e di scenari.ts. Generato da src/core/__tests__/vettori-casi.ts con `npm run vettori`: non modificare a mano.',
    convenzioni: {
      importi: 'centesimi interi (Cents)',
      date: 'stringhe ISO aaaa-mm-gg',
      percentuali: 'frazioni decimali (0.15 = 15%)',
      null: 'nel confronto null equivale a campo assente/undefined',
      parametri: '{"$parametri": anno} = getParametri(anno).parametri; con "campo" se ne prende solo quel percorso',
      formato: 'vedi docs/PORTING.md, sezione "Vettori golden"',
    },
    vettori,
  };
}
