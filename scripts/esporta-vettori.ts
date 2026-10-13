/**
 * Scrive golden/vettori.json: i casi di test del motore in forma neutra, per il porting in Swift.
 * I casi sono definiti in src/core/__tests__/vettori-casi.ts (vedi docs/PORTING.md).
 *
 * Uso: npm run vettori
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { costruisciVettori } from '../src/core/__tests__/vettori-casi';

const file = costruisciVettori();
const out = path.resolve(__dirname, '..', 'golden', 'vettori.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
console.log(`Scritto ${out}: ${file.vettori.length} vettori`);
