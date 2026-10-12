import { ymd } from '../dates';
import { euro, type Cents } from '../money';
import type { IsoDate, TrattamentoIva } from '../types';

/**
 * Interpreta il TESTO letto da una foto di fattura (OCR eseguito sul telefono).
 * Non legge immagini: riceve il testo grezzo e propone i campi da confermare.
 * L'utente deve SEMPRE confermare o correggere prima del salvataggio.
 */

export interface CampoLetto<T> {
  valore: T;
  /** 0-1: quanto il motore è sicuro del valore. */
  confidenza: number;
}

export interface FatturaLetta {
  numero?: CampoLetto<string>;
  dataFattura?: CampoLetto<IsoDate>;
  totale?: CampoLetto<Cents>;
  imponibile?: CampoLetto<Cents>;
  bollo?: CampoLetto<boolean>;
  trattamentoIva?: CampoLetto<TrattamentoIva>;
  ritenutaAcconto?: CampoLetto<Cents>;
  tipoPrestazione?: CampoLetto<string>;
  /** Nel testo c'è un codice fiscale (probabilmente del paziente): NON viene estratto né salvato. */
  contieneCodiceFiscale: boolean;
  avvisi: string[];
}

/** "1.234,56" | "1234,56" | "150" | "1,234.56" -> centesimi. */
export function parseImporto(raw: string): Cents | undefined {
  let s = raw.replace(/[€\s]/g, '').replace(/EUR/i, '');
  if (!/\d/.test(s)) return undefined;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.'); // formato italiano
  } else if (lastDot > lastComma && lastComma !== -1) {
    s = s.replace(/,/g, ''); // formato inglese
  } else if (lastDot !== -1 && lastComma === -1) {
    // "1.234" (migliaia) vs "12.50" (decimali)
    const dec = s.length - lastDot - 1;
    if (dec === 3) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? euro(n) : undefined;
}

const RE_IMPORTO = /(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2})?)(?:\s*€)?/g;

const importiNellaRiga = (riga: string): Cents[] =>
  [...riga.matchAll(RE_IMPORTO)]
    .map((m) => parseImporto(m[1]))
    .filter((v): v is Cents => v !== undefined);

/** Toglie date, percentuali e numeri di partita IVA/CAP prima di cercare gli importi. */
const pulisciRiga = (riga: string): string =>
  riga
    .replace(/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,3}(?:[.,]\d+)?\s*%/g, ' ')
    .replace(/\b\d{11}\b/g, ' ')
    .replace(/\bart\.?\s*\d+[^\s]*/gi, ' ')
    .replace(/\b\d{2,4}\/\d{4}\b/g, ' ')
    .replace(/n\.?\s*\d+/gi, ' ');

function parseData(text: string): CampoLetto<IsoDate> | undefined {
  const re = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/g;
  const candidati: { iso: IsoDate; vicinoData: boolean }[] = [];
  for (const riga of text.split('\n')) {
    for (const m of riga.matchAll(re)) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) continue;
      candidati.push({ iso: ymd(y, mo, d), vicinoData: /data|del\b|emess/i.test(riga) });
    }
  }
  if (candidati.length === 0) return undefined;
  const preferito = candidati.find((c) => c.vicinoData) ?? candidati[0];
  return { valore: preferito.iso, confidenza: preferito.vicinoData ? 0.9 : candidati.length === 1 ? 0.7 : 0.5 };
}

function parseNumero(text: string): CampoLetto<string> | undefined {
  const m = text.match(/(?:fattura|ricevuta|fatt\.)\s*(?:n(?:r|um(?:ero)?)?\.?|n°|nº)?\s*[:.\-]?\s*([A-Z]{0,3}\d+(?:[/\-][A-Z0-9]+)?)/i)
    ?? text.match(/\b(?:n(?:r)?\.?|n°|numero)\s*[:.]?\s*(\d+(?:[/\-]\d{2,4})?)\b/i);
  return m ? { valore: m[1], confidenza: 0.8 } : undefined;
}

function cercaImportoSuRiga(righe: string[], etichetta: RegExp): { valore: Cents; riga: string } | undefined {
  const trovati: { valore: Cents; riga: string }[] = [];
  for (let i = 0; i < righe.length; i++) {
    if (!etichetta.test(righe[i])) continue;
    let importi = importiNellaRiga(pulisciRiga(righe[i]));
    if (importi.length === 0 && i + 1 < righe.length) importi = importiNellaRiga(pulisciRiga(righe[i + 1]));
    if (importi.length > 0) trovati.push({ valore: importi[importi.length - 1], riga: righe[i] });
  }
  if (trovati.length === 0) return undefined;
  return trovati.reduce((max, t) => (t.valore > max.valore ? t : max));
}

export function parseInvoiceText(text: string): FatturaLetta {
  const righe = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const tutto = righe.join('\n');
  const avvisi: string[] = [];
  const out: FatturaLetta = { contieneCodiceFiscale: /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i.test(tutto), avvisi };

  out.numero = parseNumero(tutto);
  out.dataFattura = parseData(tutto);

  const tot = cercaImportoSuRiga(righe, /totale|netto\s+a\s+pagare|da\s+pagare|importo\s+dovuto/i);
  if (tot) out.totale = { valore: tot.valore, confidenza: 0.85 };

  const imp = cercaImportoSuRiga(righe, /imponibile|onorario|compenso|corrispettivo/i);
  if (imp) out.imponibile = { valore: imp.valore, confidenza: 0.8 };

  const haBollo = /bollo/i.test(tutto);
  out.bollo = { valore: haBollo, confidenza: haBollo ? 0.9 : 0.6 };

  if (/190\/2014|forfettari|regime\s+forfetario/i.test(tutto)) {
    out.trattamentoIva = { valore: 'forfettario_no_iva', confidenza: 0.9 };
  } else if (/art\.?\s*10|esent/i.test(tutto)) {
    out.trattamentoIva = { valore: 'esente_art10', confidenza: 0.85 };
  } else if (/iva\s*(?:al\s*)?22|22\s*%/i.test(tutto)) {
    out.trattamentoIva = { valore: 'imponibile_22', confidenza: 0.85 };
  }

  const rit = cercaImportoSuRiga(righe, /ritenuta/i);
  if (rit) out.ritenutaAcconto = { valore: rit.valore, confidenza: 0.75 };

  const prest = righe.find((r) => /(visita|ecografia|consulto|controllo|certificat|perizia|intervento|esame|terapia|seduta)/i.test(r));
  if (prest) out.tipoPrestazione = { valore: prest.replace(/\s{2,}/g, ' ').replace(RE_IMPORTO, '').trim().slice(0, 80), confidenza: 0.6 };

  // Se manca l'imponibile lo ricava dal totale.
  if (!out.imponibile && out.totale) {
    let valore = out.totale.valore;
    if (haBollo) valore -= 200;
    if (out.trattamentoIva?.valore === 'imponibile_22') valore = Math.round(valore / 1.22);
    out.imponibile = { valore, confidenza: 0.5 };
    avvisi.push('Imponibile ricavato dal totale: controllalo.');
  }

  if (!out.totale && !out.imponibile) {
    // ultima risorsa: l'importo più alto del documento
    const tutti = righe.flatMap((r) => importiNellaRiga(pulisciRiga(r)));
    if (tutti.length > 0) {
      out.totale = { valore: Math.max(...tutti), confidenza: 0.3 };
      avvisi.push('Totale non trovato con certezza: è stato preso l\'importo più alto.');
    }
  }

  if (out.contieneCodiceFiscale) {
    avvisi.push('Nella foto c\'è un codice fiscale: non viene salvato.');
  }
  if (!out.dataFattura) avvisi.push('Data non trovata.');
  if (!out.numero) avvisi.push('Numero fattura non trovato.');

  return out;
}
