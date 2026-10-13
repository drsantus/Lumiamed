import type { IsoDate } from './types';

/**
 * Abbonamento: un solo livello di funzioni, nessun limite sul numero di fatture o spese.
 * - prova / attivo: tutto disponibile;
 * - scaduto: sola lettura ed export (i dati restano dell'utente).
 *
 * Il motore non decide chi gestisce la prova gratuita (l'app o l'App Store) né la sua durata:
 * riceve le date e lo stato dello store e restituisce lo stato. Nessuna lettura dell'orologio.
 */
export type StatoAbbonamento = 'prova' | 'attivo' | 'scaduto';

export type Prodotto = 'pro_mensile' | 'pro_annuale' | 'founding_annuale';

export const PRODOTTI: readonly Prodotto[] = ['pro_mensile', 'pro_annuale', 'founding_annuale'];

/** Stato dell'abbonamento come lo riporta lo store (es. StoreKit / RevenueCat). */
export interface StatoStore {
  /** Prodotto dell'abbonamento in corso o più recente. Assente se l'utente non ha mai acquistato. */
  prodotto?: Prodotto;
  /** Ultimo giorno coperto (incluso) dal periodo pagato o di prova dello store. */
  scadenza?: IsoDate;
  /** true se lo store indica che il periodo in corso è una prova gratuita. */
  periodoDiProva?: boolean;
}

export interface InputAbbonamento {
  oggi: IsoDate;
  store: StatoStore;
  /** Prova gestita dall'app: ultimo giorno di prova (incluso). Assente se la prova la gestisce solo lo store. */
  fineProvaApp?: IsoDate;
}

export interface Abbonamento {
  stato: StatoAbbonamento;
  prodotto?: Prodotto;
  /** Ultimo giorno (incluso) dello stato attuale; assente se scaduto. */
  finoAl?: IsoDate;
}

/**
 * Stato dell'abbonamento alla data `oggi`:
 * 1. periodo dello store non scaduto → 'prova' se lo store lo indica come prova, altrimenti 'attivo';
 * 2. altrimenti, prova dell'app non scaduta → 'prova';
 * 3. altrimenti 'scaduto'.
 */
export function statoAbbonamento(input: InputAbbonamento): Abbonamento {
  const { oggi, store, fineProvaApp } = input;
  if (store.scadenza && oggi <= store.scadenza) {
    return { stato: store.periodoDiProva ? 'prova' : 'attivo', prodotto: store.prodotto, finoAl: store.scadenza };
  }
  if (fineProvaApp && oggi <= fineProvaApp) return { stato: 'prova', finoAl: fineProvaApp };
  return { stato: 'scaduto', prodotto: store.prodotto };
}

export type Funzione =
  | 'consultazione' // vedere dati, stime, scadenziario, analisi
  | 'inserimento' // aggiungere, modificare, eliminare movimenti e profilo
  | 'import_storico'
  | 'lettura_foto'
  | 'notifiche_scadenze'
  | 'export'; // CSV, report, backup

const SOLA_LETTURA: readonly Funzione[] = ['consultazione', 'export'];

/** Con l'abbonamento scaduto restano solo consultazione ed export. */
export const puoUsare = (stato: StatoAbbonamento, funzione: Funzione): boolean =>
  stato !== 'scaduto' || SOLA_LETTURA.includes(funzione);
