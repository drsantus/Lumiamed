/**
 * Converte gli elenchi ufficiali del MEF (Dipartimento delle Finanze) nelle tabelle
 * precaricate dell'app: src/core/addizionali/data/comunali.json
 *
 * Input: file CSV in data-raw/ con nome Add_comunale_irpefAAAA.csv
 * (scaricati da https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm)
 *
 * Regola: per ogni comune si usa la delibera più recente. Nell'elenco di un anno,
 * l'aliquota "0*" indica che per quell'anno il comune non ha pubblicato una delibera:
 * vale quella dell'ultimo anno precedente disponibile.
 *
 * Uso: npm run import-addizionali [-- --anno-riferimento 2026]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AddizionaleComunale } from '../src/core/addizionali';
import type { Scaglione } from '../src/core/params';

const ROOT = path.resolve(__dirname, '..');
// Cartella con i CSV del MEF: "data-raw" oppure "raw data"
const RAW = ['data-raw', 'raw data'].map((d) => path.join(ROOT, d)).find((d) => existsSync(d)) ?? path.join(ROOT, 'data-raw');
const OUT = path.join(ROOT, 'src', 'core', 'addizionali', 'data', 'comunali.json');

const euroToCents = (s: string): number => Math.round(Number(s.replace(/\./g, '').replace(',', '.')) * 100);
const ultimoImporto = (testo: string): number | null => {
  const m = [...testo.matchAll(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g)];
  return m.length ? euroToCents(m[m.length - 1][1]) : null;
};
const aliquota = (s: string): number => Math.round((Number(s.trim().replace(',', '.')) / 100) * 1e6) / 1e6;
const contaImporti = (t: string): number => (t.match(/\d[\d.]*(?:,\d+)?/g) ?? []).length;

interface Riga extends AddizionaleComunale {
  noteEsenzioni?: string[];
}

interface Esito {
  riga?: Riga;
  senzaDelibera: boolean;
  problema?: string;
}

function parseRiga(campi: string[], anno: number): Esito {
  const [codice, comune, pr] = campi;
  const aliq1 = (campi[8] ?? '').trim();
  if (aliq1.endsWith('*')) return { senzaDelibera: true };

  const coppie: { aliq: string; fascia: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (campi[8 + i * 2] ?? '').trim();
    const f = (campi[9 + i * 2] ?? '').trim();
    if (a === '' && f === '') continue;
    coppie.push({ aliq: a, fascia: f });
  }
  const importoEsente = Number((campi[33] ?? '0').trim() || '0');

  let aliquotaUnica: number | undefined;
  const scaglioni: Scaglione[] = [];
  let soglia = importoEsente > 0 ? importoEsente * 100 : 0;
  const noteEsenzioni: string[] = [];

  for (const { aliq, fascia } of coppie) {
    const t = fascia.toLowerCase().replace(/\s+/g, ' ');
    if (t.startsWith('esenzione')) {
      const generica = /esenzione per (redditi imponibili|reddito imponibile)? ?(fino a )?(euro |€ ?)?[\d.]+(,\d+)?$/i.test(t);
      if (generica) {
        const v = ultimoImporto(t);
        if (v !== null) soglia = Math.max(soglia, v);
      } else {
        noteEsenzioni.push(fascia.trim());
      }
      continue;
    }
    if (t.includes('aliquota unica')) {
      aliquotaUnica = aliquota(aliq);
      continue;
    }
    if (t.includes('oltre') && contaImporti(t) === 1) {
      scaglioni.push({ fino: null, aliquota: aliquota(aliq) });
      continue;
    }
    if (contaImporti(t) >= 1) {
      // "fino a 28.000", "da 15.000,01 a 28.000", "0-15.000", "tra X e Y": il limite superiore è l'ultimo importo
      const v = ultimoImporto(t);
      if (v === null) return { senzaDelibera: false, problema: `${codice} ${comune}: scaglione illeggibile "${fascia}"` };
      scaglioni.push({ fino: v, aliquota: aliquota(aliq) });
      continue;
    }
    if (aliq !== '' && fascia === '') {
      aliquotaUnica = aliquota(aliq);
      continue;
    }
    return { senzaDelibera: false, problema: `${codice} ${comune}: fascia non riconosciuta "${fascia}"` };
  }

  if (scaglioni.length > 0) {
    scaglioni.sort((a, b) => (a.fino ?? Infinity) - (b.fino ?? Infinity));
    if (scaglioni[scaglioni.length - 1].fino !== null) {
      // ultimo scaglione senza "oltre": lo rendiamo illimitato
      scaglioni[scaglioni.length - 1] = { ...scaglioni[scaglioni.length - 1], fino: null };
    }
  }
  if (aliquotaUnica === undefined && scaglioni.length === 0) {
    return { senzaDelibera: false, problema: `${codice} ${comune}: nessuna aliquota` };
  }

  const riga: Riga = {
    codiceCatastale: codice.trim().toUpperCase(),
    comune: comune.trim(),
    provincia: pr.trim(),
    anno,
    ...(scaglioni.length > 0 ? { scaglioni } : { aliquotaUnica }),
    ...(soglia > 0 ? { esenzione: { soglia, tipo: 'esclusione' as const } } : {}),
    ...(noteEsenzioni.length > 0 ? { noteEsenzioni } : {}),
  };
  return { riga, senzaDelibera: false };
}

function leggiAnno(file: string, anno: number) {
  const testo = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const righe = testo.split(/\r?\n/).filter((r) => r.trim() !== '');
  const header = righe[0].split(';');
  if (header[0] !== 'CODICE_CATASTALE' || header[8] !== 'ALIQUOTA') {
    throw new Error(`${path.basename(file)}: intestazione inattesa (${header.slice(0, 10).join(';')})`);
  }
  const risultati = new Map<string, Esito & { comune: string; provincia: string }>();
  for (const r of righe.slice(1)) {
    const campi = r.split(';');
    risultati.set(campi[0].trim().toUpperCase(), { ...parseRiga(campi, anno), comune: campi[1].trim(), provincia: campi[2].trim() });
  }
  return risultati;
}

const files = readdirSync(RAW)
  .map((f) => ({ f, m: f.match(/^Add_comunale_irpef(\d{4})\.csv$/i) }))
  .filter((x): x is { f: string; m: RegExpMatchArray } => !!x.m)
  .map(({ f, m }) => ({ file: path.join(RAW, f), anno: Number(m[1]) }))
  .sort((a, b) => b.anno - a.anno);

if (files.length === 0) {
  console.error('Nessun file Add_comunale_irpefAAAA.csv in data-raw/');
  process.exit(1);
}

const anni = files.map((x) => ({ anno: x.anno, dati: leggiAnno(x.file, x.anno) }));
const piuRecente = anni[0];
const output: Record<string, Riga> = {};
const problemi: string[] = [];
let daAnniPrecedenti = 0;
const senzaDati: string[] = [];

for (const [codice, base] of piuRecente.dati) {
  let trovato: Riga | undefined;
  for (const { dati } of anni) {
    const e = dati.get(codice);
    if (!e || e.senzaDelibera) continue;
    if (e.problema) { problemi.push(e.problema); break; }
    trovato = e.riga;
    break;
  }
  if (trovato) {
    if (trovato.anno !== piuRecente.anno) daAnniPrecedenti++;
    output[codice] = trovato;
  } else {
    // Anche senza delibera il comune resta in tabella: deve comparire nella ricerca (cercaComune).
    // L'addizionale non viene stimata e il motore lo segnala.
    senzaDati.push(`${codice} ${base.comune} (${base.provincia})`);
    output[codice] = { codiceCatastale: codice, comune: base.comune, provincia: base.provincia, anno: piuRecente.anno, senzaDelibera: true };
  }
}

const ordinato = Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(ordinato));

console.log(`Anni letti: ${anni.map((a) => a.anno).join(', ')}`);
console.log(`Comuni nell'elenco ${piuRecente.anno}: ${piuRecente.dati.size}`);
console.log(`Comuni in tabella: ${Object.keys(output).length}`);
console.log(`Comuni con aliquota: ${Object.keys(output).length - senzaDati.length} (di cui ${daAnniPrecedenti} da delibere di anni precedenti)`);
console.log(`Comuni senza delibera in nessun anno letto (in tabella con senzaDelibera): ${senzaDati.length}`);
if (problemi.length) console.log(`Righe non interpretate (${problemi.length}):\n  ${problemi.slice(0, 30).join('\n  ')}`);
writeFileSync(path.join(RAW, 'import-report.txt'), [
  `Anni: ${anni.map((a) => a.anno).join(', ')}`,
  `Comuni con aliquota: ${Object.keys(output).length}`,
  `Senza delibera in nessun anno letto (${senzaDati.length}):`, ...senzaDati,
  `Problemi (${problemi.length}):`, ...problemi,
].join('\n'));
