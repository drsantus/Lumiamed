/**
 * Tutti gli importi del motore sono in CENTESIMI (numeri interi).
 * Questo evita gli errori di arrotondamento dei numeri decimali (0.1 + 0.2).
 */
export type Cents = number;

/** Euro (anche con decimali) -> centesimi interi. */
export const euro = (value: number): Cents => Math.round(value * 100);

/** Centesimi -> euro (numero). Solo per visualizzazione. */
export const toEuro = (cents: Cents): number => cents / 100;

/** Applica una percentuale (es. 0.195) a un importo in centesimi, arrotondando al centesimo. */
export const pct = (cents: Cents, rate: number): Cents => Math.round(cents * rate);

export const sum = (values: Cents[]): Cents => values.reduce((a, b) => a + b, 0);

export const clampMin0 = (cents: Cents): Cents => (cents < 0 ? 0 : cents);

/** Formattazione italiana: 1234567 -> "€ 12.345,67" */
export const formatEuro = (cents: Cents): string => {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '-' : ''}€ ${intPart},${dec}`;
};
