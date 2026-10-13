/**
 * Scrive i file golden per il porting in Swift:
 * - golden/vettori.json: i casi di test in forma neutra (src/core/__tests__/vettori-casi.ts) e, per ogni
 *   scenario di scenari.ts, l'ISTANTANEA dell'output completo del motore (unico punto in cui un atteso
 *   viene dal motore: serve solo a verificare che lo Swift dia gli stessi risultati del TypeScript);
 * - golden/parametri.json: i parametri di ogni anno così come li restituisce getParametri;
 * - golden/checksum.json: SHA-256 dei file di dati del motore (tabelle delle addizionali).
 *
 * Uso: npm run vettori
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getParametri } from '../src/core/params';
import { PARAMETRI_2025 } from '../src/core/params/2025';
import { VERSIONE_MOTORE } from '../src/core/versione';
import { costruisciVettori, type FileVettori } from '../src/core/__tests__/vettori-casi';
import { comeJson, risultatoVettore } from '../src/core/__tests__/vettori-runner';

const ROOT = path.resolve(__dirname, '..');
const GOLDEN = path.join(ROOT, 'golden');
const generatoIl = new Date().toISOString();
const scrivi = (nome: string, dati: unknown) => writeFileSync(path.join(GOLDEN, nome), `${JSON.stringify(dati, null, 2)}\n`);
mkdirSync(GOLDEN, { recursive: true });

// Vettori, con le istantanee riempite dal motore
const casi = costruisciVettori();
const vettori = casi.vettori.map((v) => (v.istantanea ? { ...v, atteso: comeJson(risultatoVettore(v)) } : v));
const file: FileVettori = {
  versione: casi.versione,
  versioneMotore: VERSIONE_MOTORE,
  generatoIl,
  numeroVettori: vettori.length,
  descrizione: casi.descrizione,
  convenzioni: casi.convenzioni,
  vettori,
};
scrivi('vettori.json', file);

// Parametri per anno
const ANNI_PARAMETRI = [2025, 2026, 2027];
scrivi('parametri.json', {
  versioneMotore: VERSIONE_MOTORE,
  generatoIl,
  descrizione: 'Parametri normativi per anno come li restituisce getParametri(anno). Il 2025 è parziale: '
    + 'i campi di "parziali.2025" prevalgono su quelli dell\'anno completo più vicino (2026), per questo approssimati = true.',
  anni: Object.fromEntries(ANNI_PARAMETRI.map((a) => [a, getParametri(a)])),
  parziali: { 2025: PARAMETRI_2025 },
});

// Checksum dei file di dati
const FILE_DATI = ['src/core/addizionali/data/comunali.json', 'src/core/addizionali/data/regionali.json'];
const sha256 = (f: string) => createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex');
scrivi('checksum.json', {
  versioneMotore: VERSIONE_MOTORE,
  generatoIl,
  algoritmo: 'SHA-256',
  descrizione: 'Impronta dei file di dati del motore: il porting deve includerli identici, byte per byte.',
  file: Object.fromEntries(FILE_DATI.map((f) => [f, sha256(f)])),
});

console.log(`Scritto golden/: ${vettori.length} vettori (${vettori.filter((v) => v.istantanea).length} istantanee), parametri ${ANNI_PARAMETRI.join(', ')}, ${FILE_DATI.length} checksum`);
