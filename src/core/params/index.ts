import { PARAMETRI_2026 } from './2026';
import type { ParametriAnno } from './types';

export type { ParametriAnno, Fonte, Scaglione } from './types';

const TABELLA: Record<number, ParametriAnno> = {
  2026: PARAMETRI_2026,
};

export interface ParametriRisolti {
  parametri: ParametriAnno;
  /** true se per l'anno richiesto non esistono parametri e si usano quelli dell'ultimo anno disponibile. */
  approssimati: boolean;
}

/**
 * Restituisce i parametri dell'anno. Se l'anno non è in tabella usa l'anno più vicino
 * e segnala che i calcoli sono approssimati (l'app deve mostrarlo).
 */
export function getParametri(anno: number): ParametriRisolti {
  const exact = TABELLA[anno];
  if (exact) return { parametri: exact, approssimati: false };
  const anni = Object.keys(TABELLA).map(Number).sort((a, b) => a - b);
  const vicino = anni.reduce((best, y) => (Math.abs(y - anno) < Math.abs(best - anno) ? y : best), anni[0]);
  return { parametri: { ...TABELLA[vicino], anno }, approssimati: true };
}

export const anniDisponibili = (): number[] => Object.keys(TABELLA).map(Number);
