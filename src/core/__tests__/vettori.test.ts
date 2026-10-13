/**
 * Esegue i vettori golden (golden/vettori.json) sul motore TypeScript.
 * Lo stesso file serve a verificare il porting in Swift: il formato è in docs/PORTING.md.
 */
import { describe, expect, it } from 'vitest';
import vettoriJson from '../../../golden/vettori.json';
import { confrontaAcconti, pianoAcconti, proiezioneAnnua } from '../acconti';
import { addizionaleComunale, addizionaleRegionale, tabelleCaricate } from '../addizionali';
import { easterSunday, etaAl, primoGiornoLavorativo } from '../dates';
import { quotaA, quotaB } from '../enpam';
import { aliquotaForfettario, calcolaForfettario } from '../forfettario';
import { liquidazioniIva, proRata } from '../iva';
import { bolloDovuto, creditiAperti, nettoIncassato, ricaviAnno } from '../movimenti';
import { parseImporto, parseInvoiceText } from '../ocr/parseInvoiceText';
import { calcolaOrdinario, detrazioneLavoroAutonomo, speseDeducibili } from '../ordinario';
import { getParametri } from '../params';
import { puoAggiungere, puoUsare } from '../piani';
import { csvFatture, csvSpese } from '../report';
import { calcolaRiepilogo } from '../riepilogo';
import { generaScadenziario } from '../scadenziario';
import { impostaProgressiva } from '../scaglioni';
import { attribuisciVersamenti } from '../versamenti';
import { costruisciVettori, type Espr, type FileVettori, type Verifica, type Vettore } from './vettori-casi';

const file = vettoriJson as unknown as FileVettori;

/** Funzioni pubbliche usate dai vettori, con i nomi dei parametri nell'ordine della firma. */
const FUNZIONI: Record<string, { fn: (...args: any[]) => unknown; parametri: string[] }> = {
  addizionaleComunale: { fn: addizionaleComunale, parametri: ['imponibile', 'codiceCatastale', 'tabelle', 'annoRiferimento'] },
  addizionaleRegionale: { fn: addizionaleRegionale, parametri: ['imponibile', 'regione', 'tabelle'] },
  aliquotaForfettario: { fn: aliquotaForfettario, parametri: ['anno', 'profilo', 'p'] },
  attribuisciVersamenti: { fn: attribuisciVersamenti, parametri: ['spese', 'opt'] },
  bolloDovuto: { fn: bolloDovuto, parametri: ['f', 'p'] },
  calcolaForfettario: { fn: calcolaForfettario, parametri: ['input', 'p'] },
  calcolaOrdinario: { fn: calcolaOrdinario, parametri: ['input', 'p'] },
  calcolaRiepilogo: { fn: calcolaRiepilogo, parametri: ['input'] },
  confrontaAcconti: { fn: confrontaAcconti, parametri: ['baseStorica', 'impostaStimataAnnoCorrente', 'p'] },
  creditiAperti: { fn: creditiAperti, parametri: ['fatture', 'oggi', 'p'] },
  csvFatture: { fn: csvFatture, parametri: ['fatture', 'anno', 'p', 'opt'] },
  csvSpese: { fn: csvSpese, parametri: ['spese', 'anno'] },
  detrazioneLavoroAutonomo: { fn: detrazioneLavoroAutonomo, parametri: ['redditoComplessivo', 'p'] },
  easterSunday: { fn: easterSunday, parametri: ['year'] },
  etaAl: { fn: etaAl, parametri: ['dataNascita', 'al'] },
  generaScadenziario: { fn: generaScadenziario, parametri: ['opt', 'p'] },
  getParametri: { fn: getParametri, parametri: ['anno'] },
  impostaProgressiva: { fn: impostaProgressiva, parametri: ['imponibile', 'scaglioni'] },
  liquidazioniIva: { fn: liquidazioniIva, parametri: ['fatture', 'spese', 'anno', 'p'] },
  nettoIncassato: { fn: nettoIncassato, parametri: ['f', 'p'] },
  parseImporto: { fn: parseImporto, parametri: ['raw'] },
  parseInvoiceText: { fn: parseInvoiceText, parametri: ['text'] },
  pianoAcconti: { fn: pianoAcconti, parametri: ['base', 'p'] },
  primoGiornoLavorativo: { fn: primoGiornoLavorativo, parametri: ['iso'] },
  proRata: { fn: proRata, parametri: ['fatture', 'anno'] },
  proiezioneAnnua: { fn: proiezioneAnnua, parametri: ['valoreDaInizioAnno', 'oggi'] },
  puoAggiungere: { fn: puoAggiungere, parametri: ['piano', 'tipo', 'usatiNelMese', 'limiti'] },
  puoUsare: { fn: puoUsare, parametri: ['piano', 'funzione', 'limiti'] },
  quotaA: { fn: quotaA, parametri: ['anno', 'dataNascita', 'p'] },
  quotaB: { fn: quotaB, parametri: ['annoReddito', 'redditoProfessionale', 'dataNascita', 'p', 'frazioneAnno'] },
  ricaviAnno: { fn: ricaviAnno, parametri: ['fatture', 'anno', 'p', 'finoAl'] },
  speseDeducibili: { fn: speseDeducibili, parametri: ['spese', 'compensi', 'p', 'percentualeDetrazioneIva'] },
  tabelleCaricate: { fn: tabelleCaricate, parametri: ['tabelle'] },
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Segue un percorso puntato (es. "a.b") dentro un oggetto. */
const percorsoSemplice = (v: unknown, percorso: string): unknown =>
  percorso.split('.').reduce<unknown>((acc, k) => (isObj(acc) ? acc[k] : undefined), v);

/** Sostituisce i marcatori {"$parametri": anno} con i parametri dell'anno. */
function risolviInput(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(risolviInput);
  if (!isObj(x)) return x;
  if ('$parametri' in x) {
    const p = getParametri(x.$parametri as number).parametri;
    return x.campo ? percorsoSemplice(p, x.campo as string) : p;
  }
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, risolviInput(v)]));
}

function esegui(funzione: string, input: Record<string, unknown>): unknown {
  const f = FUNZIONI[funzione];
  if (!f) throw new Error(`Funzione sconosciuta: ${funzione}`);
  const extra = Object.keys(input).filter((k) => !f.parametri.includes(k));
  if (extra.length) throw new Error(`${funzione}: parametri sconosciuti ${extra.join(', ')}`);
  return f.fn(...f.parametri.map((nome) => risolviInput(input[nome])));
}

/**
 * Percorso: chiavi separate da ".", più selettori tra parentesi quadre:
 * [n] elemento n; [*] tutti gli elementi; [k=v] primo elemento con k uguale a v;
 * [k~=regex] elementi con k che corrisponde alla regex. Dopo [*] e [k~=...] il resto del percorso
 * si applica a ogni elemento. Percorso vuoto = valore intero.
 */
function leggi(v: unknown, percorso: string): unknown {
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

function valuta(e: Espr | unknown[], risultato: unknown): unknown {
  if (Array.isArray(e) || !isObj(e)) return e;
  const v = (x: Espr) => valuta(x, risultato);
  if ('$' in e) return leggi(risultato, e.$);
  if ('$parametri' in e) return risolviInput(e);
  if ('$somma' in e) return numeri(e.$somma.map(v)).reduce((a, b) => a + b, 0);
  if ('$prodotto' in e) return numeri(e.$prodotto.map(v)).reduce((a, b) => a * b, 1);
  if ('$diff' in e) return num(v(e.$diff[0])) - num(v(e.$diff[1]));
  if ('$quoziente' in e) return num(v(e.$quoziente[0])) / num(v(e.$quoziente[1]));
  if ('$max' in e) return Math.max(...numeri(e.$max.map(v)));
  if ('$abs' in e) return Math.abs(num(v(e.$abs)));
  if ('$lunghezza' in e) return (v(e.$lunghezza) as unknown[] | string).length;
  if ('$righe' in e) return (v(e.$righe) as string).split('\n').length;
  throw new Error(`Espressione sconosciuta: ${JSON.stringify(e)}`);
}

/**
 * Confronto parziale: per gli oggetti si controllano solo le chiavi attese,
 * gli array devono avere la stessa lunghezza, null vale come assente.
 * Restituisce l'elenco delle differenze (vuoto se tutto torna).
 */
function confronta(valore: unknown, atteso: unknown, dove = ''): string[] {
  if (atteso === null) return valore === null || valore === undefined ? [] : [`${dove || '(radice)'}: atteso assente, trovato ${JSON.stringify(valore)}`];
  if (Array.isArray(atteso)) {
    if (!Array.isArray(valore) || valore.length !== atteso.length) {
      return [`${dove || '(radice)'}: atteso ${JSON.stringify(atteso)}, trovato ${JSON.stringify(valore)}`];
    }
    return atteso.flatMap((a, i) => confronta(valore[i], a, `${dove}[${i}]`));
  }
  if (isObj(atteso)) {
    if (!isObj(valore)) return [`${dove || '(radice)'}: atteso un oggetto, trovato ${JSON.stringify(valore)}`];
    return Object.entries(atteso).flatMap(([k, a]) => confronta(valore[k], a, dove ? `${dove}.${k}` : k));
  }
  return Object.is(valore, atteso) ? [] : [`${dove || '(radice)'}: atteso ${JSON.stringify(atteso)}, trovato ${JSON.stringify(valore)}`];
}

function verifica(ver: Verifica, risultato: unknown): string[] {
  const valore = valuta(ver.valore, risultato);
  const atteso = ver.atteso === undefined ? undefined : valuta(ver.atteso, risultato);
  const desc = `${JSON.stringify(ver.valore)} ${ver.op} ${JSON.stringify(ver.atteso ?? '')}`;
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
    }
  })();
  return ok ? [] : [`${desc}: trovato ${JSON.stringify(valore)}`];
}

function eseguiVettore(v: Vettore): string[] {
  if (v.chiamate) {
    const risultati = Object.fromEntries(Object.entries(v.chiamate).map(([nome, c]) => [nome, esegui(c.funzione, c.input)]));
    return (v.verifiche ?? []).flatMap((ver) => verifica(ver, risultati));
  }
  const risultato = esegui(v.funzione as string, v.input ?? {});
  return [
    ...(v.atteso === undefined ? [] : confronta(risultato, v.atteso)),
    ...(v.verifiche ?? []).flatMap((ver) => verifica(ver, risultato)),
  ];
}

describe('Vettori golden (golden/vettori.json)', () => {
  it('il JSON è aggiornato rispetto a vettori-casi.ts e scenari.ts (altrimenti: npm run vettori)', () => {
    expect(file).toEqual(JSON.parse(JSON.stringify(costruisciVettori())));
  });

  it('id unici e ogni vettore verifica qualcosa', () => {
    const ids = file.vettori.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of file.vettori) {
      expect(v.atteso !== undefined || (v.verifiche?.length ?? 0) > 0, v.id).toBe(true);
      expect(!!v.funzione !== !!v.chiamate, v.id).toBe(true);
    }
  });

  it.each(file.vettori.map((v) => [v.id, v] as const))('%s', (_id, v) => {
    expect(eseguiVettore(v)).toEqual([]);
  });
});
