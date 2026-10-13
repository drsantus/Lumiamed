import { PARAMETRI_2025 } from './2025';
import { PARAMETRI_2026 } from './2026';
import { PARAMETRI_2027 } from './2027';
import type { ParametriAnno, ParametriParziali } from './types';

export type { ParametriAnno, ParametriParziali, Fonte, Scaglione } from './types';

const TABELLA: Record<number, ParametriAnno> = {
  2026: PARAMETRI_2026,
  2027: PARAMETRI_2027,
};

/** Anni con solo alcuni parametri: il resto viene dall'anno completo più vicino. */
const PARZIALI: Record<number, ParametriParziali> = {
  2025: PARAMETRI_2025,
};

export interface ParametriRisolti {
  parametri: ParametriAnno;
  /** true se per l'anno richiesto non esistono (tutti) i parametri e si usano quelli dell'anno più vicino. */
  approssimati: boolean;
}

const isOggetto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Unione profonda: i campi di `sopra` sostituiscono quelli di `base`; gli array si sostituiscono interi. */
function unisci<T>(base: T, sopra: unknown): T {
  if (!isOggetto(base) || !isOggetto(sopra)) return (sopra === undefined ? base : sopra) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(sopra)) out[k] = unisci(base[k], v);
  return out as T;
}

/**
 * Restituisce i parametri dell'anno. Se l'anno non è in tabella usa l'anno completo più vicino
 * (a parità di distanza il più vecchio) e segnala che i calcoli sono approssimati (l'app deve mostrarlo).
 * Se l'anno ha solo alcuni parametri (es. 2025), quelli prevalgono sull'anno più vicino.
 */
export function getParametri(anno: number): ParametriRisolti {
  const exact = TABELLA[anno];
  if (exact) return { parametri: exact, approssimati: false };
  const anni = Object.keys(TABELLA).map(Number).sort((a, b) => a - b);
  const vicino = anni.reduce((best, y) => (Math.abs(y - anno) < Math.abs(best - anno) ? y : best), anni[0]);
  const base: ParametriAnno = { ...TABELLA[vicino], anno };
  return { parametri: PARZIALI[anno] ? unisci(base, PARZIALI[anno]) : base, approssimati: true };
}

/** Anni con tutti i parametri. */
export const anniDisponibili = (): number[] => Object.keys(TABELLA).map(Number);

/**
 * Percorsi dei gruppi di parametri con `verificato: false` (es. "irpef", "enpam.quotaB.sogliaEsenzione"),
 * in ordine di dichiarazione: l'app li mostra come "stima".
 */
export function parametriDaVerificare(p: ParametriAnno): string[] {
  const out: string[] = [];
  const visita = (x: unknown, percorso: string) => {
    if (!isOggetto(x)) return;
    if (x.verificato === false && percorso) out.push(percorso);
    for (const [k, v] of Object.entries(x)) visita(v, percorso ? `${percorso}.${k}` : k);
  };
  visita(p, '');
  return out;
}
