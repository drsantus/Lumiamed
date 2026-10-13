/// <reference types="node" />
/**
 * Esegue i vettori golden (golden/vettori.json) sul motore TypeScript e controlla parametri.json e checksum.json.
 * Gli stessi file servono a verificare il porting in Swift: il formato è in docs/PORTING.md.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import checksumJson from '../../../golden/checksum.json';
import parametriJson from '../../../golden/parametri.json';
import vettoriJson from '../../../golden/vettori.json';
import { getParametri } from '../params';
import { VERSIONE_MOTORE } from '../versione';
import { SCENARI_ACCONTI, SCENARI_DASHBOARD, SCENARI_FORFETTARIO, SCENARI_ORDINARIO, SCENARI_QUOTA_A, SCENARI_QUOTA_B } from './scenari';
import { costruisciVettori, type FileVettori, type Vettore } from './vettori-casi';
import { comeJson, eseguiVettore } from './vettori-runner';

const file = vettoriJson as unknown as FileVettori;

/** Il vettore senza l'atteso delle istantanee (che viene dal motore, non da vettori-casi.ts). */
const senzaIstantanea = (v: Vettore): Vettore => {
  if (!v.istantanea) return v;
  const { atteso: _atteso, ...resto } = v;
  return resto;
};

/** Percorsi di oggetti con chiavi "$..." (percorsi, espressioni, segnaposto) dentro un atteso. */
function segnaposto(x: unknown, dove: string): string[] {
  if (Array.isArray(x)) return x.flatMap((y, i) => segnaposto(y, `${dove}[${i}]`));
  if (typeof x !== 'object' || x === null) return [];
  return Object.entries(x).flatMap(([k, v]) => (k.startsWith('$') ? [`${dove}.${k}`] : segnaposto(v, `${dove}.${k}`)));
}

describe('Vettori golden (golden/vettori.json)', () => {
  it('intestazione: versione del motore e numero di vettori', () => {
    expect(file.versioneMotore).toBe(VERSIONE_MOTORE);
    expect(file.numeroVettori).toBe(file.vettori.length);
    expect(Number.isNaN(Date.parse(file.generatoIl))).toBe(false);
  });

  it('il JSON è aggiornato rispetto a vettori-casi.ts e scenari.ts (altrimenti: npm run vettori)', () => {
    const casi = comeJson(costruisciVettori()) as ReturnType<typeof costruisciVettori>;
    expect({ versione: file.versione, descrizione: file.descrizione, convenzioni: file.convenzioni, vettori: file.vettori.map(senzaIstantanea) })
      .toEqual(casi);
  });

  it('id unici, ogni vettore verifica qualcosa, attesi solo letterali', () => {
    const ids = file.vettori.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of file.vettori) {
      expect(v.atteso !== undefined || (v.verifiche?.length ?? 0) > 0, v.id).toBe(true);
      expect(!!v.funzione !== !!v.chiamate, v.id).toBe(true);
      expect([...segnaposto(v.atteso, `${v.id}.atteso`), ...(v.verifiche ?? []).flatMap((x, i) => segnaposto(x.atteso, `${v.id}.verifiche[${i}].atteso`))]).toEqual([]);
    }
  });

  it('un\'istantanea completa per ogni scenario di scenari.ts', () => {
    const scenari = [SCENARI_FORFETTARIO, SCENARI_ORDINARIO, SCENARI_QUOTA_A, SCENARI_QUOTA_B, SCENARI_ACCONTI, SCENARI_DASHBOARD].flat().map((s) => `istantanea/${s.id}`);
    const istantanee = file.vettori.filter((v) => v.istantanea);
    expect(istantanee.map((v) => v.id).sort()).toEqual(scenari.sort());
    expect(istantanee.every((v) => v.atteso !== undefined && v.atteso !== null)).toBe(true);
  });

  it.each(file.vettori.map((v) => [v.id, v] as const))('%s', (_id, v) => {
    expect(eseguiVettore(v)).toEqual([]);
  });
});

describe('Parametri (golden/parametri.json)', () => {
  const anni = (parametriJson as unknown as { anni: Record<string, unknown> }).anni;

  it('2025, 2026 e 2027, uguali a getParametri (altrimenti: npm run vettori)', () => {
    expect(Object.keys(anni)).toEqual(['2025', '2026', '2027']);
    for (const [anno, risolti] of Object.entries(anni)) expect(risolti).toEqual(comeJson(getParametri(Number(anno))));
  });
});

describe('Checksum dei file di dati (golden/checksum.json)', () => {
  const { file: impronte } = checksumJson as { file: Record<string, string> };

  it.each(Object.entries(impronte))('%s', (percorso, sha) => {
    const contenuto = readFileSync(new URL(`../../../${percorso}`, import.meta.url));
    expect(createHash('sha256').update(contenuto).digest('hex')).toBe(sha);
  });

  it('copre le tabelle delle addizionali', () => {
    expect(Object.keys(impronte)).toEqual(['src/core/addizionali/data/comunali.json', 'src/core/addizionali/data/regionali.json']);
  });
});
