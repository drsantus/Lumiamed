import type { Cents } from './money';
import type { Scaglione } from './params';

export interface QuotaScaglione {
  da: Cents;
  a: Cents | null;
  aliquota: number;
  base: Cents;
  imposta: Cents;
}

/**
 * Imposta progressiva per scaglioni: ogni aliquota si applica solo alla parte
 * di reddito che cade nel proprio scaglione. Arrotondamento al centesimo per scaglione.
 */
export function impostaProgressiva(imponibile: Cents, scaglioni: Scaglione[]): { totale: Cents; dettaglio: QuotaScaglione[] } {
  let precedente: Cents = 0;
  const dettaglio: QuotaScaglione[] = [];
  for (const s of scaglioni) {
    const limite = s.fino ?? Number.POSITIVE_INFINITY;
    const base = Math.max(0, Math.min(imponibile, limite) - precedente);
    dettaglio.push({ da: precedente, a: s.fino, aliquota: s.aliquota, base, imposta: Math.round(base * s.aliquota) });
    if (imponibile <= limite) break;
    precedente = limite;
  }
  return { totale: dettaglio.reduce((a, d) => a + d.imposta, 0), dettaglio };
}
