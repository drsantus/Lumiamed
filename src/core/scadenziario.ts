import { isoYear, lastDayOfMonth, primoGiornoLavorativo, ymd } from './dates';
import type { Cents } from './money';
import { getParametri, type ParametriAnno } from './params';
import type { IsoDate, Profilo } from './types';

export type CategoriaScadenza = 'enpam' | 'imposte' | 'iva' | 'sts' | 'bollo' | 'dichiarazioni';

export interface Scadenza {
  /** Univoco all'interno dell'anno: con la finestra di 12 mesi la coppia (anno, id) è univoca. */
  id: string;
  /** Anno dello scadenziario a cui appartiene. */
  anno: number;
  /**
   * Data effettiva: le scadenze fiscali che cadono di sabato, domenica o festivo slittano al primo giorno
   * lavorativo; le scadenze ENPAM (Quota A, Quota B, Modello D) restano alla data nominale.
   */
  data: IsoDate;
  /** Data nominale prevista dalla norma. */
  dataNominale: IsoDate;
  categoria: CategoriaScadenza;
  titolo: string;
  descrizione: string;
  importoStimato?: Cents;
}

/** Importi stimati da mostrare accanto alle scadenze (tutti facoltativi). */
export interface ImportiScadenze {
  quotaA?: Cents;
  /** Quota B sui redditi dell'anno precedente (pagata da ottobre di quest'anno). */
  quotaB?: Cents;
  /** Quota B sui redditi di due anni fa (rate che cadono tra gennaio e giugno di quest'anno). */
  quotaBCicloPrecedente?: Cents;
  saldoImposte?: Cents;
  /** Ordinario: saldo delle addizionali dell'anno precedente (regionale intera, comunale al netto dell'acconto). */
  saldoAddizionali?: Cents;
  primoAcconto?: Cents;
  secondoAcconto?: Cents;
  accontoAddizionaleComunale?: Cents;
  ivaTrimestri?: Partial<Record<1 | 2 | 3 | 4, Cents>>;
  ivaSaldoAnnoPrecedente?: Cents;
}

const RATE_QUOTA_A: Record<Profilo['rateQuotaA'], number[]> = {
  1: [4],
  4: [4, 6, 9, 11],
  8: [4, 5, 6, 7, 8, 9, 10, 11],
};

/** Mesi delle rate Quota B: [anno relativo (0 = anno di inizio), mese]. */
const RATE_QUOTA_B: Record<Profilo['rateQuotaB'], [number, number][]> = {
  1: [[0, 10]],
  2: [[0, 10], [0, 12]],
  5: [[0, 10], [0, 12], [1, 2], [1, 4], [1, 6]],
  9: [[0, 10], [0, 11], [0, 12], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6]],
};

/** Quota della Quota B (redditi dell'anno scorso) che scade entro l'anno in corso, in base al piano di rate. */
export const frazioneQuotaBNellAnno = (rate: Profilo['rateQuotaB']): number =>
  RATE_QUOTA_B[rate].filter(([rel]) => rel === 0).length / RATE_QUOTA_B[rate].length;

const dividi = (totale: Cents | undefined, parti: number, indice: number): Cents | undefined => {
  if (totale === undefined) return undefined;
  const base = Math.floor(totale / parti);
  return indice === parti - 1 ? totale - base * (parti - 1) : base;
};

/** Quota A scaduta entro il mese indicato (compresa la rata del mese), secondo il piano di rate. */
export const quotaADovutaEntro = (rate: Profilo['rateQuotaA'], totale: Cents, mese: number): Cents =>
  RATE_QUOTA_A[rate].reduce((acc, m, i) => (m <= mese ? acc + (dividi(totale, RATE_QUOTA_A[rate].length, i) as Cents) : acc), 0);

/** true se nel mese scade una rata di Quota B (redditi dell'anno scorso o di due anni fa). */
export const rataQuotaBNelMese = (rate: Profilo['rateQuotaB'], mese: number): boolean =>
  RATE_QUOTA_B[rate].some(([, m]) => m === mese);

export interface OpzioniScadenziario {
  anno: number;
  profilo: Pick<Profilo, 'regime' | 'rateQuotaA' | 'rateQuotaB' | 'emetteFattureElettroniche'>;
  /** Il medico emette anche fatture con IVA (ordinario). */
  haOperazioniIva: boolean;
  importi?: ImportiScadenze;
}

export function generaScadenziario(opt: OpzioniScadenziario, p: ParametriAnno): Scadenza[] {
  const { anno, profilo } = opt;
  const imp = opt.importi ?? {};
  const out: Scadenza[] = [];
  // Le date specifiche (es. proroghe) valgono solo se i parametri sono proprio di quell'anno.
  const usaParametriAnno = isoYear(p.scadenze.saldoPrimoAccontoIsa) === anno;

  const add = (
    id: string, dataNominale: IsoDate, categoria: CategoriaScadenza,
    titolo: string, descrizione: string, importoStimato?: Cents,
  ) => {
    const enpam = categoria === 'enpam' || id === 'modelloD';
    out.push({ id, anno, data: enpam ? dataNominale : primoGiornoLavorativo(dataNominale), dataNominale, categoria, titolo, descrizione, importoStimato });
  };

  // Sistema Tessera Sanitaria
  add('sts', usaParametriAnno ? p.scadenze.invioSTS : ymd(anno, 1, 31), 'sts',
    'Invio spese al Sistema TS',
    `Trasmissione al Sistema Tessera Sanitaria delle spese sanitarie incassate nel ${anno - 1}. Sanzione: 100 € per ogni fattura non inviata.`);

  // ENPAM Quota A
  const mesiA = RATE_QUOTA_A[profilo.rateQuotaA];
  mesiA.forEach((m, i) =>
    add(`quotaA-${i + 1}`, lastDayOfMonth(anno, m), 'enpam',
      mesiA.length === 1 ? 'ENPAM Quota A' : `ENPAM Quota A — rata ${i + 1}/${mesiA.length}`,
      `Contributo fisso ENPAM ${anno}.`, dividi(imp.quotaA, mesiA.length, i)));

  // Modello D
  add('modelloD', usaParametriAnno ? p.scadenze.modelloD : ymd(anno, 7, 31), 'dichiarazioni',
    'ENPAM Modello D', `Dichiarazione a ENPAM del reddito libero-professionale ${anno - 1} (salvo proroghe).`);

  // ENPAM Quota B: rate del ciclo iniziato l'anno scorso + ciclo che inizia quest'anno
  const rateB = RATE_QUOTA_B[profilo.rateQuotaB];
  rateB.forEach(([rel, m], i) => {
    if (rel === 1) {
      add(`quotaB-prec-${i + 1}`, lastDayOfMonth(anno, m), 'enpam',
        `ENPAM Quota B ${anno - 2} — rata ${i + 1}/${rateB.length}`,
        `Rata della Quota B sui redditi ${anno - 2} (con interessi legali).`,
        dividi(imp.quotaBCicloPrecedente, rateB.length, i));
    }
  });
  rateB.forEach(([rel, m], i) => {
    if (rel === 0) {
      add(`quotaB-${i + 1}`, lastDayOfMonth(anno, m), 'enpam',
        rateB.length === 1 ? `ENPAM Quota B ${anno - 1}` : `ENPAM Quota B ${anno - 1} — rata ${i + 1}/${rateB.length}`,
        `Contributo proporzionale sul reddito libero-professionale ${anno - 1}.`,
        dividi(imp.quotaB, rateB.length, i));
    }
  });

  // Imposte
  const nomeImposta = profilo.regime === 'forfettario' ? 'imposta sostitutiva' : 'IRPEF e addizionali';
  const dataSaldo = usaParametriAnno ? p.scadenze.saldoPrimoAccontoIsa : ymd(anno, 6, 30);
  const saldoEAcconto =
    imp.saldoImposte !== undefined || imp.primoAcconto !== undefined
      ? (imp.saldoImposte ?? 0) + (imp.saldoAddizionali ?? 0) + (imp.primoAcconto ?? 0) + (imp.accontoAddizionaleComunale ?? 0)
      : undefined;
  add('saldo-primo-acconto', dataSaldo, 'imposte',
    `Saldo ${anno - 1} e 1° acconto ${anno}`,
    `Saldo ${nomeImposta} ${anno - 1} e primo acconto ${anno}${usaParametriAnno ? '' : ' (data standard: verifica eventuali proroghe)'}.`,
    saldoEAcconto);
  add('secondo-acconto', usaParametriAnno ? p.scadenze.secondoAcconto : ymd(anno, 11, 30), 'imposte',
    `2° acconto ${anno}`, `Secondo acconto (o acconto in unica soluzione) ${nomeImposta} ${anno}.`, imp.secondoAcconto);

  add('dichiarazione', usaParametriAnno ? p.scadenze.dichiarazioneRedditi : ymd(anno, 10, 31), 'dichiarazioni',
    'Dichiarazione dei redditi', `Invio del modello Redditi PF ${anno} (redditi ${anno - 1}).`);

  // IVA (solo ordinario con prestazioni imponibili)
  if (profilo.regime === 'ordinario' && opt.haOperazioniIva) {
    add('iva-saldo', ymd(anno, 3, 16), 'iva', `IVA saldo ${anno - 1}`, 'Saldo IVA annuale (con 1% di interessi per i trimestrali).', imp.ivaSaldoAnnoPrecedente);
    add('iva-t1', ymd(anno, 5, 16), 'iva', 'IVA 1° trimestre', 'Liquidazione IVA gennaio-marzo.', imp.ivaTrimestri?.[1]);
    add('iva-t2', ymd(anno, 8, 20), 'iva', 'IVA 2° trimestre', 'Liquidazione IVA aprile-giugno.', imp.ivaTrimestri?.[2]);
    add('iva-t3', ymd(anno, 11, 16), 'iva', 'IVA 3° trimestre', 'Liquidazione IVA luglio-settembre.', imp.ivaTrimestri?.[3]);
    add('iva-acconto', ymd(anno, 12, 27), 'iva', 'Acconto IVA', 'Acconto IVA di dicembre (88% del 4° trimestre dell\'anno precedente, metodo storico).');
  }

  // Bollo virtuale sulle fatture elettroniche
  if (profilo.emetteFattureElettroniche) {
    add('bollo-t4', lastDayOfMonth(anno, 2), 'bollo', `Bollo fatture elettroniche 4° trim. ${anno - 1}`, 'Imposta di bollo sulle fatture elettroniche (F24).');
    add('bollo-t1', ymd(anno, 5, 31), 'bollo', 'Bollo fatture elettroniche 1° trim.', 'Imposta di bollo sulle fatture elettroniche (F24).');
    add('bollo-t2', ymd(anno, 9, 30), 'bollo', 'Bollo fatture elettroniche 2° trim.', 'Imposta di bollo sulle fatture elettroniche (F24).');
    add('bollo-t3', ymd(anno, 11, 30), 'bollo', 'Bollo fatture elettroniche 3° trim.', 'Imposta di bollo sulle fatture elettroniche (F24).');
  }

  return out.sort((a, b) => (a.data === b.data ? a.id.localeCompare(b.id) : a.data.localeCompare(b.data)));
}

/** Scadenze nei prossimi `giorni` giorni (per le notifiche e la dashboard). */
export const scadenzeImminenti = (scadenze: Scadenza[], oggi: IsoDate, entro: IsoDate): Scadenza[] =>
  scadenze.filter((s) => s.data >= oggi && s.data <= entro);

export interface OpzioniScadenziarioMobile {
  oggi: IsoDate;
  profilo: OpzioniScadenziario['profilo'];
  haOperazioniIva: boolean;
  /** Importi delle scadenze dell'anno di `oggi`. */
  importi?: ImportiScadenze;
  /**
   * Importi noti delle scadenze dell'anno successivo. Le rate di Quota B di gennaio-giugno dell'anno
   * successivo appartengono allo stesso ciclo di `importi.quotaB`: se non indicate le si prende da lì.
   */
  importiAnnoSuccessivo?: ImportiScadenze;
}

/**
 * Scadenze dei prossimi 12 mesi: da oggi (compreso) allo stesso giorno dell'anno successivo (escluso).
 * Unisce lo scadenziario dell'anno in corso e quello dell'anno successivo, ciascuno con i propri parametri,
 * così a dicembre compaiono già il Sistema TS e le rate di gennaio.
 */
export function scadenzeProssimi12Mesi(opt: OpzioniScadenziarioMobile): Scadenza[] {
  const anno = isoYear(opt.oggi);
  const mese = Number(opt.oggi.slice(5, 7));
  const giorno = ymd(anno + 1, mese, Number(opt.oggi.slice(8, 10)));
  const fine = giorno <= lastDayOfMonth(anno + 1, mese) ? giorno : lastDayOfMonth(anno + 1, mese);
  const corrente = generaScadenziario(
    { anno, profilo: opt.profilo, haOperazioniIva: opt.haOperazioniIva, importi: opt.importi },
    getParametri(anno).parametri,
  );
  const successivo = generaScadenziario(
    {
      anno: anno + 1, profilo: opt.profilo, haOperazioniIva: opt.haOperazioniIva,
      importi: { quotaBCicloPrecedente: opt.importi?.quotaB, ...opt.importiAnnoSuccessivo },
    },
    getParametri(anno + 1).parametri,
  );
  return [...corrente, ...successivo]
    .filter((s) => s.data >= opt.oggi && s.data < fine)
    .sort((a, b) => (a.data === b.data ? a.anno - b.anno || a.id.localeCompare(b.id) : a.data.localeCompare(b.data)));
}
