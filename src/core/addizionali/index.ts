import { pct, type Cents } from '../money';
import type { Scaglione } from '../params';
import { impostaProgressiva } from '../scaglioni';
import type { Avviso, RegioneCode } from '../types';
import comunaliData from './data/comunali.json';
import regionaliData from './data/regionali.json';

/**
 * Esenzione:
 * - 'esclusione': sotto la soglia non si paga nulla, sopra si paga su tutto il reddito;
 * - 'franchigia': si paga solo sulla parte che supera la soglia.
 */
export interface Esenzione {
  soglia: Cents;
  tipo: 'esclusione' | 'franchigia';
}

export interface AddizionaleRegionale {
  regione: RegioneCode;
  anno: number;
  /** Aliquote progressive per scaglione. */
  scaglioni: Scaglione[];
  esenzione?: Esenzione;
  /** Se l'imponibile non supera la soglia, si applica questa aliquota su tutto il reddito (es. FVG, Lazio, Umbria). */
  aliquotaAgevolata?: { finoReddito: Cents; aliquota: number };
  /** Detrazioni fisse dall'addizionale per fascia di reddito (es. Bolzano, Lazio, Umbria). */
  detrazioni?: { da: Cents; a: Cents; importo: Cents }[];
  /** Agevolazioni non applicate in automatico (figli, disabilità...). */
  note?: string;
  fonte: string;
}

export interface AddizionaleComunale {
  codiceCatastale: string;
  comune: string;
  provincia: string;
  anno: number;
  /** Aliquota unica oppure scaglioni. */
  aliquotaUnica?: number;
  scaglioni?: Scaglione[];
  esenzione?: Esenzione;
  /** Esenzioni per categorie (pensionati, redditi bassi di lavoro autonomo, ...): non applicate in automatico. */
  noteEsenzioni?: string[];
}

export interface TabelleAddizionali {
  regionali: Record<string, AddizionaleRegionale>;
  comunali: Record<string, AddizionaleComunale>;
}

const TABELLE_PRECARICATE: TabelleAddizionali = {
  regionali: regionaliData as unknown as Record<string, AddizionaleRegionale>,
  comunali: comunaliData as unknown as Record<string, AddizionaleComunale>,
};

/** Aliquota base nazionale dell'addizionale regionale (usata se la regione non è in tabella). */
export const ALIQUOTA_REGIONALE_BASE = 0.0123;

function applicaEsenzione(imponibile: Cents, esenzione: Esenzione | undefined, calcola: (base: Cents) => Cents): Cents {
  if (!esenzione) return calcola(imponibile);
  if (imponibile <= esenzione.soglia) return 0;
  return esenzione.tipo === 'franchigia' ? calcola(imponibile - esenzione.soglia) : calcola(imponibile);
}

export interface RisultatoAddizionale {
  importo: Cents;
  avvisi: Avviso[];
}

export function addizionaleRegionale(
  imponibile: Cents,
  regione: RegioneCode | undefined,
  tabelle: TabelleAddizionali = TABELLE_PRECARICATE,
): RisultatoAddizionale {
  const dati = regione ? tabelle.regionali[regione] : undefined;
  if (!dati) {
    return {
      importo: pct(imponibile, ALIQUOTA_REGIONALE_BASE),
      avvisi: [{
        codice: 'ADD_REG_NON_TROVATA',
        livello: 'attenzione',
        messaggio: 'Aliquota della tua regione non disponibile: stima calcolata con l\'aliquota base dell\'1,23%.',
      }],
    };
  }
  const calcola = (base: Cents): Cents => {
    const agev = dati.aliquotaAgevolata;
    if (agev && imponibile <= agev.finoReddito) return pct(base, agev.aliquota);
    return impostaProgressiva(base, dati.scaglioni).totale;
  };
  const lorda = applicaEsenzione(imponibile, dati.esenzione, calcola);
  const detrazione = (dati.detrazioni ?? [])
    .filter((d) => imponibile >= d.da && imponibile <= d.a)
    .reduce((t, d) => t + d.importo, 0);
  const avvisi: Avviso[] = dati.note
    ? [{ codice: 'ADD_REG_AGEVOLAZIONI', livello: 'info', messaggio: `Addizionale regionale: ${dati.note}` }]
    : [];
  return { importo: Math.max(0, lorda - detrazione), avvisi };
}

export function addizionaleComunale(
  imponibile: Cents,
  codiceCatastale: string | undefined,
  tabelle: TabelleAddizionali = TABELLE_PRECARICATE,
  annoRiferimento?: number,
): RisultatoAddizionale {
  const dati = codiceCatastale ? tabelle.comunali[codiceCatastale.toUpperCase()] : undefined;
  if (!dati) {
    return {
      importo: 0,
      avvisi: [{
        codice: 'ADD_COM_NON_TROVATA',
        livello: 'attenzione',
        messaggio: 'Comune non impostato o senza delibere recenti in tabella: addizionale comunale non inclusa nella stima. Chiedi l\'aliquota al commercialista.',
      }],
    };
  }
  const calcola = (base: Cents): Cents =>
    dati.scaglioni ? impostaProgressiva(base, dati.scaglioni).totale : pct(base, dati.aliquotaUnica ?? 0);
  const avvisi: Avviso[] = [];
  if (annoRiferimento !== undefined && dati.anno < annoRiferimento) {
    avvisi.push({
      codice: 'ADD_COM_DELIBERA_PRECEDENTE',
      livello: 'info',
      messaggio: `Il comune non ha pubblicato una nuova delibera: si usa l'aliquota del ${dati.anno}.`,
    });
  }
  if (dati.noteEsenzioni?.length) {
    avvisi.push({
      codice: 'ADD_COM_ESENZIONI_PARTICOLARI',
      livello: 'info',
      messaggio: `Il tuo comune prevede esenzioni particolari non applicate nella stima: ${dati.noteEsenzioni.join(' | ')}`,
    });
  }
  return { importo: applicaEsenzione(imponibile, dati.esenzione, calcola), avvisi };
}

export const cercaComune = (testo: string, tabelle: TabelleAddizionali = TABELLE_PRECARICATE): AddizionaleComunale[] => {
  const q = testo.trim().toLowerCase();
  if (q.length < 2) return [];
  return Object.values(tabelle.comunali)
    .filter((c) => c.comune.toLowerCase().startsWith(q))
    .slice(0, 20);
};

export const tabelleCaricate = (tabelle: TabelleAddizionali = TABELLE_PRECARICATE) => ({
  regioni: Object.keys(tabelle.regionali).length,
  comuni: Object.keys(tabelle.comunali).length,
});
