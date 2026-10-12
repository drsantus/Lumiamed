import type { IsoDate } from './types';

/** Lavora in UTC per evitare problemi di fuso orario e ora legale. */
export const parseIso = (iso: IsoDate): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const toIso = (date: Date): IsoDate => date.toISOString().slice(0, 10);

export const isoYear = (iso: IsoDate): number => Number(iso.slice(0, 4));
export const isoMonth = (iso: IsoDate): number => Number(iso.slice(5, 7));

export const ymd = (y: number, m: number, d: number): IsoDate =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const addDays = (iso: IsoDate, days: number): IsoDate => {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
};

export const daysBetween = (from: IsoDate, to: IsoDate): number =>
  Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);

/** Ultimo giorno del mese (m = 1..12). */
export const lastDayOfMonth = (y: number, m: number): IsoDate =>
  ymd(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());

/** Pasqua (algoritmo di Meeus/Jones/Butcher). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

/** Festività nazionali italiane. */
export function festivita(year: number): Set<IsoDate> {
  const fixed = [
    [1, 1], [1, 6], [4, 25], [5, 1], [6, 2], [8, 15], [11, 1], [12, 8], [12, 25], [12, 26],
  ].map(([m, d]) => ymd(year, m, d));
  return new Set([...fixed, addDays(easterSunday(year), 1)]);
}

export const isWeekend = (iso: IsoDate): boolean => {
  const day = parseIso(iso).getUTCDay();
  return day === 0 || day === 6;
};

export const isGiornoLavorativo = (iso: IsoDate): boolean =>
  !isWeekend(iso) && !festivita(isoYear(iso)).has(iso);

/**
 * Le scadenze fiscali che cadono di sabato, domenica o festivo slittano
 * al primo giorno lavorativo successivo.
 */
export function primoGiornoLavorativo(iso: IsoDate): IsoDate {
  let current = iso;
  while (!isGiornoLavorativo(current)) current = addDays(current, 1);
  return current;
}

/** Età compiuta alla data indicata. */
export function etaAl(dataNascita: IsoDate, al: IsoDate): number {
  const n = parseIso(dataNascita);
  const a = parseIso(al);
  let eta = a.getUTCFullYear() - n.getUTCFullYear();
  const compleanno = a.getUTCMonth() > n.getUTCMonth() ||
    (a.getUTCMonth() === n.getUTCMonth() && a.getUTCDate() >= n.getUTCDate());
  if (!compleanno) eta -= 1;
  return eta;
}
