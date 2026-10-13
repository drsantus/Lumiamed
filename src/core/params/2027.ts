import { euro } from '../money';
import { PARAMETRI_2026 } from './2026';
import type { ParametriAnno } from './types';

const NOTA = 'Provvisorio: copia del 2026, da rivedere dopo la legge di bilancio 2027.';

/**
 * PARAMETRI 2027 — PROVVISORI. Copia del 2026 con tutto `verificato: false`.
 * Scadenze: date standard (le stesse che lo scadenziario usa quando mancano i parametri).
 */
export const PARAMETRI_2027: ParametriAnno = {
  ...PARAMETRI_2026,
  anno: 2027,
  forfettario: {
    ...PARAMETRI_2026.forfettario,
    verificato: false,
    nota: NOTA,
    sogliaRedditiDipendente: {
      fonte: 'L. 190/2014 art. 1 c. 57 lett. d-ter',
      verificato: false,
      nota: 'da rivedere dopo la legge di bilancio 2027',
      importo: euro(30_000),
    },
  },
  irpef: { ...PARAMETRI_2026.irpef, verificato: false, nota: NOTA },
  detrazioneLavoroAutonomo: { ...PARAMETRI_2026.detrazioneLavoroAutonomo, verificato: false, nota: NOTA },
  detrazioneLavoroDipendente: { ...PARAMETRI_2026.detrazioneLavoroDipendente, verificato: false },
  acconti: { ...PARAMETRI_2026.acconti, verificato: false, nota: NOTA },
  enpam: {
    ...PARAMETRI_2026.enpam,
    verificato: false,
    nota: NOTA,
    quotaA: { ...PARAMETRI_2026.enpam.quotaA, verificato: false, nota: 'Copia degli importi 2026: ENPAM pubblica quelli 2027 a inizio anno.' },
    quotaB: {
      ...PARAMETRI_2026.enpam.quotaB,
      sogliaEsenzione: { ...PARAMETRI_2026.enpam.quotaB.sogliaEsenzione, verificato: false, nota: 'Copia della stima 2026.' },
    },
  },
  iva: { ...PARAMETRI_2026.iva, verificato: false, nota: NOTA },
  bollo: { ...PARAMETRI_2026.bollo, verificato: false },
  spese: { ...PARAMETRI_2026.spese, verificato: false },
  scadenze: {
    fonte: 'Date standard (nessuna proroga nota)',
    verificato: false,
    nota: NOTA,
    saldoPrimoAccontoIsa: '2027-06-30',
    secondoAcconto: '2027-11-30',
    dichiarazioneRedditi: '2027-10-31',
    invioSTS: '2027-01-31',
    modelloD: '2027-07-31',
  },
};
