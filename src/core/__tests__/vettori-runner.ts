/**
 * Esecutore dei vettori golden sul motore TypeScript. Usato da vettori.test.ts e da scripts/esporta-vettori.ts
 * (che lo usa SOLO per salvare le istantanee). Il runner Swift deve seguire le stesse regole (docs/PORTING.md).
 */
import { confrontaAcconti, pianoAcconti, proiezioneAnnua } from '../acconti';
import { addizionaleComunale, addizionaleRegionale, cercaComune, tabelleCaricate } from '../addizionali';
import { confrontoAnnoPrecedente, doveVanno100Euro, serieMensili, spesePerCategoria } from '../analisi';
import { esportaBackup, importaBackup } from '../backup';
import { easterSunday, etaAl, isGiornoLavorativo, primoGiornoLavorativo } from '../dates';
import { quotaA, quotaB } from '../enpam';
import { aliquotaForfettario, avvisiRequisitiForfettario, calcolaForfettario } from '../forfettario';
import { liquidazioniIva, proRata } from '../iva';
import { bolloDovuto, creditiAperti, nettoIncassato, ricaviAnno } from '../movimenti';
import { parseImporto, parseInvoiceText } from '../ocr/parseInvoiceText';
import { calcolaOrdinario, detrazioneLavoroAutonomo, speseDeducibili } from '../ordinario';
import { getParametri, parametriDaVerificare } from '../params';
import { puoUsare, statoAbbonamento } from '../piani';
import { csvFatture, csvSpese } from '../report';
import { calcolaRiepilogo } from '../riepilogo';
import { generaScadenziario, scadenzeProssimi12Mesi } from '../scadenziario';
import { impostaProgressiva } from '../scaglioni';
import { anteprimaImportCsv, parseDataItaliana, storicoDaTotaleAnno, storicoDaTotaliMensili } from '../storico';
import { dataIsoValida, validaFattura, validaProfilo, validaSpesa } from '../validazione';
import { attribuisciVersamenti } from '../versamenti';
import type { Espr, Verifica, Vettore } from './vettori-casi';

/** Funzioni pubbliche usate dai vettori, con i nomi dei parametri nell'ordine della firma. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FUNZIONI: Record<string, { fn: (...args: any[]) => unknown; parametri: string[] }> = {
  addizionaleComunale: { fn: addizionaleComunale, parametri: ['imponibile', 'codiceCatastale', 'tabelle', 'annoRiferimento'] },
  addizionaleRegionale: { fn: addizionaleRegionale, parametri: ['imponibile', 'regione', 'tabelle'] },
  aliquotaForfettario: { fn: aliquotaForfettario, parametri: ['anno', 'profilo', 'p'] },
  anteprimaImportCsv: { fn: anteprimaImportCsv, parametri: ['testo', 'opt'] },
  attribuisciVersamenti: { fn: attribuisciVersamenti, parametri: ['spese', 'opt'] },
  avvisiRequisitiForfettario: { fn: avvisiRequisitiForfettario, parametri: ['profilo', 'p'] },
  bolloDovuto: { fn: bolloDovuto, parametri: ['f', 'p'] },
  calcolaForfettario: { fn: calcolaForfettario, parametri: ['input', 'p'] },
  calcolaOrdinario: { fn: calcolaOrdinario, parametri: ['input', 'p'] },
  calcolaRiepilogo: { fn: calcolaRiepilogo, parametri: ['input'] },
  cercaComune: { fn: cercaComune, parametri: ['testo', 'tabelle'] },
  confrontaAcconti: { fn: confrontaAcconti, parametri: ['baseStorica', 'impostaStimataAnnoCorrente', 'p'] },
  confrontoAnnoPrecedente: { fn: confrontoAnnoPrecedente, parametri: ['fatture', 'spese', 'oggi'] },
  creditiAperti: { fn: creditiAperti, parametri: ['fatture', 'oggi', 'p'] },
  csvFatture: { fn: csvFatture, parametri: ['fatture', 'anno', 'p', 'opt'] },
  csvSpese: { fn: csvSpese, parametri: ['spese', 'anno'] },
  dataIsoValida: { fn: dataIsoValida, parametri: ['iso'] },
  detrazioneLavoroAutonomo: { fn: detrazioneLavoroAutonomo, parametri: ['redditoComplessivo', 'p'] },
  doveVanno100Euro: { fn: doveVanno100Euro, parametri: ['r'] },
  easterSunday: { fn: easterSunday, parametri: ['year'] },
  esportaBackup: { fn: esportaBackup, parametri: ['dati', 'creatoIl'] },
  etaAl: { fn: etaAl, parametri: ['dataNascita', 'al'] },
  generaScadenziario: { fn: generaScadenziario, parametri: ['opt', 'p'] },
  getParametri: { fn: getParametri, parametri: ['anno'] },
  importaBackup: { fn: importaBackup, parametri: ['testo'] },
  impostaProgressiva: { fn: impostaProgressiva, parametri: ['imponibile', 'scaglioni'] },
  isGiornoLavorativo: { fn: isGiornoLavorativo, parametri: ['iso'] },
  liquidazioniIva: { fn: liquidazioniIva, parametri: ['fatture', 'spese', 'anno', 'p'] },
  nettoIncassato: { fn: nettoIncassato, parametri: ['f', 'p'] },
  parametriDaVerificare: { fn: parametriDaVerificare, parametri: ['p'] },
  parseDataItaliana: { fn: parseDataItaliana, parametri: ['testo'] },
  parseImporto: { fn: parseImporto, parametri: ['raw'] },
  parseInvoiceText: { fn: parseInvoiceText, parametri: ['text'] },
  pianoAcconti: { fn: pianoAcconti, parametri: ['base', 'p'] },
  primoGiornoLavorativo: { fn: primoGiornoLavorativo, parametri: ['iso'] },
  proRata: { fn: proRata, parametri: ['fatture', 'anno'] },
  proiezioneAnnua: { fn: proiezioneAnnua, parametri: ['valoreDaInizioAnno', 'oggi'] },
  puoUsare: { fn: puoUsare, parametri: ['stato', 'funzione'] },
  quotaA: { fn: quotaA, parametri: ['anno', 'dataNascita', 'p'] },
  quotaB: { fn: quotaB, parametri: ['annoReddito', 'redditoProfessionale', 'dataNascita', 'p', 'frazioneAnno', 'aliquota'] },
  ricaviAnno: { fn: ricaviAnno, parametri: ['fatture', 'anno', 'p', 'finoAl'] },
  scadenzeProssimi12Mesi: { fn: scadenzeProssimi12Mesi, parametri: ['opt'] },
  serieMensili: { fn: serieMensili, parametri: ['fatture', 'spese', 'anno', 'p', 'finoAl'] },
  speseDeducibili: { fn: speseDeducibili, parametri: ['spese', 'compensi', 'p', 'percentualeDetrazioneIva'] },
  spesePerCategoria: { fn: spesePerCategoria, parametri: ['spese', 'anno', 'finoAl'] },
  statoAbbonamento: { fn: statoAbbonamento, parametri: ['input'] },
  storicoDaTotaleAnno: { fn: storicoDaTotaleAnno, parametri: ['totale', 'opt'] },
  storicoDaTotaliMensili: { fn: storicoDaTotaliMensili, parametri: ['mesi', 'opt'] },
  tabelleCaricate: { fn: tabelleCaricate, parametri: ['tabelle'] },
  validaFattura: { fn: validaFattura, parametri: ['f', 'oggi'] },
  validaProfilo: { fn: validaProfilo, parametri: ['p', 'oggi'] },
  validaSpesa: { fn: validaSpesa, parametri: ['s', 'oggi'] },
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Segue un percorso puntato (es. "a.b") dentro un oggetto. */
const percorsoSemplice = (v: unknown, percorso: string): unknown =>
  percorso.split('.').reduce<unknown>((acc, k) => (isObj(acc) ? acc[k] : undefined), v);

/** Normalizza come il JSON: toglie le chiavi undefined (in Swift: campi nil non serializzati). */
export const comeJson = (x: unknown): unknown => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

/**
 * Segnaposto ammessi SOLO negli input:
 * - {"$parametri": anno, "campo"?: percorso} = getParametri(anno).parametri (o solo quel campo);
 * - {"$risultatoDi": nome, "percorso"?: percorso} = risultato di una chiamata precedente dello stesso vettore
 *   (o solo la parte indicata dal percorso, con la sintassi delle verifiche).
 */
function risolviInput(x: unknown, risultati: Record<string, unknown>): unknown {
  if (Array.isArray(x)) return x.map((y) => risolviInput(y, risultati));
  if (!isObj(x)) return x;
  if ('$parametri' in x) {
    const p = getParametri(x.$parametri as number).parametri;
    return x.campo ? percorsoSemplice(p, x.campo as string) : p;
  }
  if ('$risultatoDi' in x) {
    const nome = x.$risultatoDi as string;
    if (!(nome in risultati)) throw new Error(`Chiamata "${nome}" non ancora eseguita`);
    return x.percorso ? leggi(risultati[nome], x.percorso as string) : risultati[nome];
  }
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, risolviInput(v, risultati)]));
}

export function esegui(funzione: string, input: Record<string, unknown>, risultati: Record<string, unknown> = {}): unknown {
  const f = FUNZIONI[funzione];
  if (!f) throw new Error(`Funzione sconosciuta: ${funzione}`);
  const extra = Object.keys(input).filter((k) => !f.parametri.includes(k));
  if (extra.length) throw new Error(`${funzione}: parametri sconosciuti ${extra.join(', ')}`);
  return f.fn(...f.parametri.map((nome) => risolviInput(input[nome], risultati)));
}

/**
 * Percorso: chiavi separate da ".", più selettori tra parentesi quadre:
 * [n] elemento n; [*] tutti gli elementi; [k=v] primo elemento con k uguale a v;
 * [k~=regex] elementi con k che corrisponde alla regex. Dopo [*] e [k~=...] il resto del percorso
 * si applica a ogni elemento. Percorso vuoto = valore intero.
 */
export function leggi(v: unknown, percorso: string): unknown {
  const token = percorso.match(/\[[^\]]*\]|[^.[\]]+/g) ?? [];
  const passo = (val: unknown, i: number): unknown => {
    if (i === token.length) return val;
    const t = token[i];
    if (!t.startsWith('[')) return passo(isObj(val) ? val[t] : undefined, i + 1);
    const sel = t.slice(1, -1);
    const arr = Array.isArray(val) ? val : [];
    if (sel === '*') return arr.map((el) => passo(el, i + 1));
    if (/^\d+$/.test(sel)) return passo(arr[Number(sel)], i + 1);
    const m = sel.match(/^([^=~]+)(~?=)(.*)$/);
    if (!m) throw new Error(`Selettore non valido: ${t}`);
    const [, campo, opSel, valore] = m;
    if (opSel === '=') return passo(arr.find((el) => isObj(el) && String(el[campo]) === valore), i + 1);
    const re = new RegExp(valore);
    return arr.filter((el) => isObj(el) && re.test(String(el[campo]))).map((el) => passo(el, i + 1));
  };
  return passo(v, 0);
}

const num = (x: unknown): number => {
  if (typeof x !== 'number') throw new Error(`Atteso un numero, trovato ${JSON.stringify(x)}`);
  return x;
};
const numeri = (xs: unknown[]): number[] => xs.flatMap((x) => (Array.isArray(x) ? x.map((y) => (y ?? 0) as number) : [num(x)]));

/** Valuta il `valore` di una verifica (percorsi ed espressioni). Gli attesi sono sempre letterali. */
export function valuta(e: Espr | unknown[], risultato: unknown): unknown {
  if (Array.isArray(e) || !isObj(e)) return e;
  const v = (x: Espr) => valuta(x, risultato);
  if ('$' in e) return leggi(risultato, e.$);
  if ('$somma' in e) return numeri(e.$somma.map(v)).reduce((a, b) => a + b, 0);
  if ('$prodotto' in e) return numeri(e.$prodotto.map(v)).reduce((a, b) => a * b, 1);
  if ('$diff' in e) return num(v(e.$diff[0])) - num(v(e.$diff[1]));
  if ('$quoziente' in e) return num(v(e.$quoziente[0])) / num(v(e.$quoziente[1]));
  if ('$max' in e) return Math.max(...numeri(e.$max.map(v)));
  if ('$abs' in e) return Math.abs(num(v(e.$abs)));
  if ('$lunghezza' in e) return (v(e.$lunghezza) as unknown[] | string).length;
  if ('$righe' in e) return (v(e.$righe) as string).split('\n').length;
  if ('$uguali' in e) return JSON.stringify(comeJson(v(e.$uguali[0]))) === JSON.stringify(comeJson(v(e.$uguali[1])));
  throw new Error(`Espressione sconosciuta: ${JSON.stringify(e)}`);
}

/**
 * Confronto parziale: per gli oggetti si controllano solo le chiavi attese,
 * gli array devono avere la stessa lunghezza, null vale come assente.
 */
export function confronta(valore: unknown, atteso: unknown, dove = ''): string[] {
  const qui = dove || '(radice)';
  if (atteso === null) return valore === null || valore === undefined ? [] : [`${qui}: atteso assente, trovato ${JSON.stringify(valore)}`];
  if (Array.isArray(atteso)) {
    if (!Array.isArray(valore) || valore.length !== atteso.length) return [`${qui}: atteso ${JSON.stringify(atteso)}, trovato ${JSON.stringify(valore)}`];
    return atteso.flatMap((a, i) => confronta(valore[i], a, `${dove}[${i}]`));
  }
  if (isObj(atteso)) {
    if (!isObj(valore)) return [`${qui}: atteso un oggetto, trovato ${JSON.stringify(valore)}`];
    return Object.entries(atteso).flatMap(([k, a]) => confronta(valore[k], a, dove ? `${dove}.${k}` : k));
  }
  return Object.is(valore, atteso) ? [] : [`${qui}: atteso ${JSON.stringify(atteso)}, trovato ${JSON.stringify(valore)}`];
}

/** Confronto esatto delle istantanee: stesse chiavi e stessi valori, dopo la normalizzazione JSON. */
export function confrontaEsatto(valore: unknown, atteso: unknown, dove = ''): string[] {
  const qui = dove || '(radice)';
  if (Array.isArray(atteso)) {
    if (!Array.isArray(valore) || valore.length !== atteso.length) return [`${qui}: lunghezza diversa`];
    return atteso.flatMap((a, i) => confrontaEsatto(valore[i], a, `${dove}[${i}]`));
  }
  if (isObj(atteso)) {
    if (!isObj(valore)) return [`${qui}: atteso un oggetto`];
    const chiavi = new Set([...Object.keys(atteso), ...Object.keys(valore)]);
    return [...chiavi].flatMap((k) => (k in atteso && k in valore
      ? confrontaEsatto(valore[k], atteso[k], dove ? `${dove}.${k}` : k)
      : [`${dove ? `${dove}.${k}` : k}: chiave ${k in atteso ? 'mancante' : 'in più'}`]));
  }
  return Object.is(valore, atteso) ? [] : [`${qui}: atteso ${JSON.stringify(atteso)}, trovato ${JSON.stringify(valore)}`];
}

export function verifica(ver: Verifica, risultato: unknown): string[] {
  const valore = valuta(ver.valore, risultato);
  const atteso = ver.atteso;
  const desc = `${JSON.stringify(ver.valore)} ${ver.op} ${JSON.stringify(atteso ?? '')}`;
  const ok = ((): boolean => {
    switch (ver.op) {
      case 'uguale': return confronta(valore, atteso).length === 0;
      case 'maggioreDi': return num(valore) > num(atteso);
      case 'minoreDi': return num(valore) < num(atteso);
      case 'minoreOUguale': return num(valore) <= num(atteso);
      case 'vicino': return Math.abs(num(valore) - num(atteso)) < 10 ** -(ver.cifre ?? 2) / 2;
      case 'contiene':
      case 'nonContiene': {
        const c = typeof valore === 'string'
          ? valore.includes(atteso as string)
          : Array.isArray(valore) && valore.some((x) => confronta(x, atteso).length === 0);
        return ver.op === 'contiene' ? c : !c;
      }
      case 'corrisponde': return new RegExp(atteso as string).test(valore as string);
      case 'jsonNonContiene': return !JSON.stringify(valore).includes(atteso as string);
      case 'ordinato': return (valore as (string | number)[]).every((x, i, a) => i === 0 || a[i - 1] <= x);
      case 'tuttiNellIntervallo': {
        const [min, max] = atteso as [string | number, string | number];
        return (valore as (string | number)[]).every((x) => x >= min && x < max);
      }
    }
  })();
  return ok ? [] : [`${desc}: trovato ${JSON.stringify(valore)}`];
}

/** Esegue le chiamate in ordine; restituisce il risultato (forma semplice) o la mappa dei risultati. */
export function risultatoVettore(v: Pick<Vettore, 'funzione' | 'input' | 'chiamate'>): unknown {
  if (v.chiamate) {
    const risultati: Record<string, unknown> = {};
    for (const [nome, c] of Object.entries(v.chiamate)) risultati[nome] = esegui(c.funzione, c.input, risultati);
    return risultati;
  }
  return esegui(v.funzione as string, v.input ?? {});
}

/** Elenco delle differenze tra motore e vettore (vuoto se tutto torna). */
export function eseguiVettore(v: Vettore): string[] {
  const risultato = risultatoVettore(v);
  if (v.istantanea) return confrontaEsatto(comeJson(risultato), v.atteso);
  return [
    ...(v.atteso === undefined ? [] : confronta(risultato, v.atteso)),
    ...(v.verifiche ?? []).flatMap((ver) => verifica(ver, risultato)),
  ];
}
