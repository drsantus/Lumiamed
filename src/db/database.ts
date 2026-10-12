/**
 * Archivio locale (SQLite sul telefono). Nessun dato esce dal dispositivo.
 * Le entità sono salvate come JSON più alcune colonne indicizzate per le ricerche.
 * Il backup iCloud del dispositivo include il database; per l'export usare il report CSV.
 */
import * as SQLite from 'expo-sqlite';
import type { Fattura, Profilo, Spesa } from '@/core';

const DB_NAME = 'lumiamed.db';
const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = apri();
  return dbPromise;
}

async function apri(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (chiave TEXT PRIMARY KEY NOT NULL, valore TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS profilo (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS fatture (
      id TEXT PRIMARY KEY NOT NULL,
      data_fattura TEXT NOT NULL,
      data_incasso TEXT,
      stato TEXT NOT NULL,
      json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fatture_incasso ON fatture (data_incasso);
    CREATE INDEX IF NOT EXISTS idx_fatture_data ON fatture (data_fattura);
    CREATE TABLE IF NOT EXISTS spese (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      categoria TEXT NOT NULL,
      json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_spese_data ON spese (data);
  `);
  await db.runAsync('INSERT OR IGNORE INTO meta (chiave, valore) VALUES (?, ?)', 'schema_version', String(SCHEMA_VERSION));
  return db;
}

// ---------- Profilo ----------

export async function leggiProfilo(): Promise<Profilo | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM profilo WHERE id = 1');
  return row ? (JSON.parse(row.json) as Profilo) : null;
}

export async function salvaProfilo(profilo: Profilo): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO profilo (id, json) VALUES (1, ?)', JSON.stringify(profilo));
}

// ---------- Fatture ----------

export async function elencoFatture(): Promise<Fattura[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM fatture ORDER BY data_fattura DESC');
  return rows.map((r) => JSON.parse(r.json) as Fattura);
}

export async function salvaFattura(f: Fattura): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO fatture (id, data_fattura, data_incasso, stato, json) VALUES (?, ?, ?, ?, ?)',
    f.id, f.dataFattura, f.dataIncasso ?? null, f.stato, JSON.stringify(f),
  );
}

export async function eliminaFattura(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM fatture WHERE id = ?', id);
}

/** Numero di fatture inserite nel mese (per i limiti del piano Free). */
export async function contaFattureMese(anno: number, mese: number): Promise<number> {
  const db = await getDb();
  const prefisso = `${anno}-${String(mese).padStart(2, '0')}`;
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM fatture WHERE data_fattura LIKE ?', `${prefisso}%`);
  return row?.n ?? 0;
}

// ---------- Spese ----------

export async function elencoSpese(): Promise<Spesa[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM spese ORDER BY data DESC');
  return rows.map((r) => JSON.parse(r.json) as Spesa);
}

export async function salvaSpesa(s: Spesa): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO spese (id, data, categoria, json) VALUES (?, ?, ?, ?)',
    s.id, s.data, s.categoria, JSON.stringify(s),
  );
}

export async function eliminaSpesa(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM spese WHERE id = ?', id);
}

export async function contaSpeseMese(anno: number, mese: number): Promise<number> {
  const db = await getDb();
  const prefisso = `${anno}-${String(mese).padStart(2, '0')}`;
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM spese WHERE data LIKE ?', `${prefisso}%`);
  return row?.n ?? 0;
}

/** Cancella tutti i dati (diritto all'oblio / reset dell'app). */
export async function cancellaTutto(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM fatture; DELETE FROM spese; DELETE FROM profilo;');
}
