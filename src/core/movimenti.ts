import { daysBetween, isoYear } from './dates';
import { pct, sum, type Cents } from './money';
import type { ParametriAnno } from './params';
import type { Fattura, IsoDate, Spesa } from './types';

/** La marca da bollo da 2€ è dovuta sulle fatture senza IVA di importo superiore a 77,47€. */
export function bolloDovuto(f: Pick<Fattura, 'imponibile' | 'trattamentoIva'>, p: ParametriAnno): boolean {
  return f.trattamentoIva !== 'imponibile_22' && f.imponibile > p.bollo.soglia;
}

export function ivaFattura(f: Fattura, p: ParametriAnno): Cents {
  if (f.trattamentoIva !== 'imponibile_22') return 0;
  return f.iva ?? pct(f.imponibile, p.iva.aliquotaOrdinaria);
}

/** Totale del documento: imponibile + IVA + bollo addebitato. */
export function totaleFattura(f: Fattura, p: ParametriAnno): Cents {
  return f.imponibile + ivaFattura(f, p) + (f.bolloAddebitato ? p.bollo.importo : 0);
}

/** Netto effettivamente incassato: totale meno eventuale ritenuta d'acconto. */
export function nettoIncassato(f: Fattura, p: ParametriAnno): Cents {
  return totaleFattura(f, p) - (f.ritenutaAcconto ?? 0);
}

/** Fatture incassate nell'anno (principio di cassa). */
export const fattureIncassateAnno = (fatture: Fattura[], anno: number): Fattura[] =>
  fatture.filter((f) => f.stato === 'incassata' && f.dataIncasso && isoYear(f.dataIncasso) === anno);

/** Ricavi/compensi rilevanti fiscalmente nell'anno (senza IVA). */
export function ricaviAnno(fatture: Fattura[], anno: number, p: ParametriAnno, finoAl?: IsoDate): Cents {
  return sum(
    fattureIncassateAnno(fatture, anno)
      .filter((f) => !finoAl || (f.dataIncasso as string) <= finoAl)
      .map((f) => f.imponibile + (f.bolloAddebitato && p.bollo.addebitatoConcorreAlReddito ? p.bollo.importo : 0)),
  );
}

export const ritenuteAnno = (fatture: Fattura[], anno: number): Cents =>
  sum(fattureIncassateAnno(fatture, anno).map((f) => f.ritenutaAcconto ?? 0));

export const speseAnno = (spese: Spesa[], anno: number, finoAl?: IsoDate): Spesa[] =>
  spese.filter((s) => isoYear(s.data) === anno && (!finoAl || s.data <= finoAl));

/** Contributi ENPAM versati nell'anno: deducibili (principio di cassa). */
export const contributiEnpamVersati = (spese: Spesa[], anno: number, finoAl?: IsoDate): Cents =>
  sum(speseAnno(spese, anno, finoAl).filter((s) => s.categoria === 'contributi_enpam').map((s) => s.importo));

export interface Credito {
  fattura: Fattura;
  giorni: number;
  importo: Cents;
}

/** Fatture ancora da incassare, dalla più vecchia. */
export function creditiAperti(fatture: Fattura[], oggi: IsoDate, p: ParametriAnno): Credito[] {
  return fatture
    .filter((f) => f.stato === 'da_incassare')
    .map((f) => ({ fattura: f, giorni: daysBetween(f.dataFattura, oggi), importo: nettoIncassato(f, p) }))
    .sort((a, b) => b.giorni - a.giorni);
}
