import { isoMonth, isoYear, lastDayOfMonth, ymd } from './dates';
import { sum, type Cents } from './money';
import { fattureIncassateAnno, speseAnno } from './movimenti';
import { getParametri, type ParametriAnno } from './params';
import type { Riepilogo } from './riepilogo';
import type { CategoriaSpesa, Fattura, IsoDate, Spesa } from './types';

/**
 * Analisi per i grafici. Principio di cassa: incassi alla data di incasso, spese alla data di pagamento.
 * - incassi: ricavi fiscali (imponibile, più il bollo solo se concorre al reddito), come `ricaviAnno`;
 * - spese: spese professionali pagate, esclusi contributi ENPAM e F24 (che non sono costi dell'attività);
 * - netto: incassi − spese, prima di imposte e contributi.
 */

export interface PuntoMese {
  /** 1 = gennaio. */
  mese: number;
  incassi: Cents;
  spese: Cents;
  netto: Cents;
}

const speseProfessionali = (spese: Spesa[], anno: number, finoAl?: IsoDate): Spesa[] =>
  speseAnno(spese, anno, finoAl).filter((s) => s.categoria !== 'contributi_enpam' && s.categoria !== 'imposte_f24');

const ricavoFattura = (f: Fattura, p: ParametriAnno): Cents =>
  f.imponibile + (f.bolloAddebitato && p.bollo.addebitatoConcorreAlReddito ? p.bollo.importo : 0);

/** Dodici punti, da gennaio a dicembre. Con `finoAl` si contano solo i movimenti fino a quella data. */
export function serieMensili(fatture: Fattura[], spese: Spesa[], anno: number, p: ParametriAnno, finoAl?: IsoDate): PuntoMese[] {
  const incassate = fattureIncassateAnno(fatture, anno).filter((f) => !finoAl || (f.dataIncasso as string) <= finoAl);
  const pagate = speseProfessionali(spese, anno, finoAl);
  return Array.from({ length: 12 }, (_, i) => {
    const mese = i + 1;
    const incassi = sum(incassate.filter((f) => isoMonth(f.dataIncasso as string) === mese).map((f) => ricavoFattura(f, p)));
    const uscite = sum(pagate.filter((s) => isoMonth(s.data) === mese).map((s) => s.importo));
    return { mese, incassi, spese: uscite, netto: incassi - uscite };
  });
}

export interface VoceCategoria {
  categoria: CategoriaSpesa;
  importo: Cents;
  /** Quota sul totale delle spese professionali (0-1). */
  quota: number;
}

/** Spese professionali per categoria, dalla più alta (a parità, per codice della categoria). */
export function spesePerCategoria(spese: Spesa[], anno: number, finoAl?: IsoDate): VoceCategoria[] {
  const pagate = speseProfessionali(spese, anno, finoAl);
  const totale = sum(pagate.map((s) => s.importo));
  if (totale <= 0) return [];
  const perCategoria = new Map<CategoriaSpesa, Cents>();
  for (const s of pagate) perCategoria.set(s.categoria, (perCategoria.get(s.categoria) ?? 0) + s.importo);
  return [...perCategoria.entries()]
    .map(([categoria, importo]) => ({ categoria, importo, quota: importo / totale }))
    .sort((a, b) => b.importo - a.importo || (a.categoria < b.categoria ? -1 : a.categoria > b.categoria ? 1 : 0));
}

/** Come si dividono 100 € incassati, in centesimi: la somma delle quattro voci è sempre 10.000. */
export interface DoveVanno100Euro {
  /** Spese professionali al netto dell'IVA detraibile. */
  spese: Cents;
  /** Imposte maturate da inizio anno. */
  imposte: Cents;
  /** Quota A e Quota B ENPAM maturate da inizio anno. */
  contributi: Cents;
  /** Guadagno netto: quello che resta (può essere negativo se i costi superano gli incassi). */
  netto: Cents;
}

/**
 * "Dove vanno 100 €" dal riepilogo: ogni voce è voce × 10.000 / ricavi arrotondata al centesimo,
 * il netto è il resto (così la somma fa esattamente 100 €). undefined se non ci sono ricavi.
 */
export function doveVanno100Euro(r: Riepilogo): DoveVanno100Euro | undefined {
  if (r.ricavi <= 0) return undefined;
  const speseNette = r.speseProfessionali - (r.iva?.totaleCredito ?? 0);
  const imposte = r.accantonamento.imposteMaturate;
  // guadagnoNetto = ricavi − spese nette − imposte − contributi maturati
  const contributi = r.ricavi - speseNette - imposte - r.guadagnoNetto;
  const su100 = (v: Cents): Cents => Math.round((v * 10_000) / r.ricavi);
  const spese = su100(speseNette);
  const imp = su100(imposte);
  const contr = su100(contributi);
  return { spese, imposte: imp, contributi: contr, netto: 10_000 - spese - imp - contr };
}

export interface TotaliConfronto {
  incassi: Cents;
  spese: Cents;
  netto: Cents;
}

export interface ConfrontoAnnoPrecedente {
  anno: number;
  /** Stesso giorno dell'anno precedente (il 29/2 diventa 28/2). */
  stessoGiornoAnnoPrecedente: IsoDate;
  /** Serie dell'anno in corso fino a oggi e dell'anno precedente intero. */
  mesi: { mese: number; anno: PuntoMese; annoPrecedente: PuntoMese }[];
  /** Da inizio anno a oggi. */
  totale: TotaliConfronto;
  /** Da inizio anno precedente allo stesso giorno. */
  totalePrecedente: TotaliConfronto;
  /** Variazione degli incassi rispetto allo stesso periodo (0.1 = +10%); assente senza incassi l'anno prima. */
  variazioneIncassi?: number;
}

const totali = (serie: PuntoMese[]): TotaliConfronto => {
  const incassi = sum(serie.map((x) => x.incassi));
  const spese = sum(serie.map((x) => x.spese));
  return { incassi, spese, netto: incassi - spese };
};

/** Confronto con lo stesso periodo dell'anno precedente, dai movimenti registrati. */
export function confrontoAnnoPrecedente(fatture: Fattura[], spese: Spesa[], oggi: IsoDate): ConfrontoAnnoPrecedente {
  const anno = isoYear(oggi);
  const p = getParametri(anno).parametri;
  const pPrec = getParametri(anno - 1).parametri;
  const mese = isoMonth(oggi);
  const ultimo = lastDayOfMonth(anno - 1, mese);
  const giorno = ymd(anno - 1, mese, Number(oggi.slice(8, 10)));
  const stessoGiorno = giorno <= ultimo ? giorno : ultimo;

  const corrente = serieMensili(fatture, spese, anno, p, oggi);
  const precedente = serieMensili(fatture, spese, anno - 1, pPrec);
  const totale = totali(corrente);
  const totalePrecedente = totali(serieMensili(fatture, spese, anno - 1, pPrec, stessoGiorno));
  return {
    anno,
    stessoGiornoAnnoPrecedente: stessoGiorno,
    mesi: corrente.map((x, i) => ({ mese: x.mese, anno: x, annoPrecedente: precedente[i] })),
    totale,
    totalePrecedente,
    variazioneIncassi: totalePrecedente.incassi > 0 ? (totale.incassi - totalePrecedente.incassi) / totalePrecedente.incassi : undefined,
  };
}
