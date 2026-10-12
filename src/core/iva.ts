import { isoMonth, isoYear } from './dates';
import { ivaFattura } from './movimenti';
import { pct, sum, type Cents } from './money';
import type { ParametriAnno } from './params';
import type { Fattura, Spesa } from './types';

/**
 * IVA per il regime ordinario, liquidazione trimestrale (professionisti sotto i limiti).
 * Le prestazioni sanitarie sono esenti: l'IVA riguarda solo le prestazioni non sanitarie
 * (medicina estetica non terapeutica, perizie, certificati medico-legali).
 * Con operazioni sia esenti sia imponibili l'IVA sugli acquisti si detrae in base al pro-rata.
 */

export const trimestreDi = (iso: string): 1 | 2 | 3 | 4 => (Math.floor((isoMonth(iso) - 1) / 3) + 1) as 1 | 2 | 3 | 4;

/** Percentuale di detrazione (pro-rata), arrotondata all'unità superiore (art. 19-bis DPR 633/72). */
export function proRata(fatture: Fattura[], anno: number): number {
  const delAnno = fatture.filter((f) => isoYear(f.dataFattura) === anno && f.trattamentoIva !== 'forfettario_no_iva');
  const imponibili = sum(delAnno.filter((f) => f.trattamentoIva === 'imponibile_22').map((f) => f.imponibile));
  const esenti = sum(delAnno.filter((f) => f.trattamentoIva === 'esente_art10').map((f) => f.imponibile));
  if (imponibili === 0) return 0;
  if (esenti === 0) return 1;
  return Math.ceil((imponibili / (imponibili + esenti)) * 100) / 100;
}

export interface LiquidazioneTrimestre {
  trimestre: 1 | 2 | 3 | 4;
  ivaDebito: Cents;
  ivaCredito: Cents;
  creditoPrecedente: Cents;
  /** Positivo = da versare, include l'1% di interessi. */
  daVersare: Cents;
  interessi: Cents;
  creditoDaRiportare: Cents;
}

export interface RisultatoIva {
  anno: number;
  proRata: number;
  trimestri: LiquidazioneTrimestre[];
  totaleDebito: Cents;
  totaleCredito: Cents;
  /** Nessuna prestazione imponibile: non c'è IVA da versare. */
  soloEsenti: boolean;
}

export function liquidazioniIva(fatture: Fattura[], spese: Spesa[], anno: number, p: ParametriAnno): RisultatoIva {
  const pr = proRata(fatture, anno);
  let credito: Cents = 0;
  const trimestri: LiquidazioneTrimestre[] = ([1, 2, 3, 4] as const).map((t) => {
    const ivaDebito = sum(
      fatture
        .filter((f) => isoYear(f.dataFattura) === anno && trimestreDi(f.dataFattura) === t)
        .map((f) => ivaFattura(f, p)),
    );
    const ivaCredito = pct(
      sum(spese.filter((s) => isoYear(s.data) === anno && trimestreDi(s.data) === t).map((s) => s.iva ?? 0)),
      pr,
    );
    const saldo = ivaDebito - ivaCredito - credito;
    const creditoPrecedente = credito;
    if (saldo > 0) {
      const interessi = pct(saldo, p.iva.interessiTrimestrali);
      credito = 0;
      return { trimestre: t, ivaDebito, ivaCredito, creditoPrecedente, daVersare: saldo + interessi, interessi, creditoDaRiportare: 0 };
    }
    credito = -saldo;
    return { trimestre: t, ivaDebito, ivaCredito, creditoPrecedente, daVersare: 0, interessi: 0, creditoDaRiportare: credito };
  });

  return {
    anno,
    proRata: pr,
    trimestri,
    totaleDebito: sum(trimestri.map((t) => t.ivaDebito)),
    totaleCredito: sum(trimestri.map((t) => t.ivaCredito)),
    soloEsenti: pr === 0,
  };
}
