import type { Fattura, Profilo, Spesa } from './types';
import { validaFattura, validaProfilo, validaSpesa } from './validazione';
import { VERSIONE_MOTORE } from './versione';

/**
 * Backup dei dati in JSON. Il motore non legge l'orologio: la data di creazione la passa l'app.
 * Aumentare VERSIONE_SCHEMA_BACKUP se cambia la forma dei dati; importaBackup deve continuare
 * a leggere le versioni precedenti (convertendole) e rifiutare quelle successive.
 */
export const SCHEMA_BACKUP = 'lumiamed-backup';
export const VERSIONE_SCHEMA_BACKUP = 1;

export interface DatiBackup {
  profilo?: Profilo;
  fatture: Fattura[];
  spese: Spesa[];
}

export interface FileBackup extends DatiBackup {
  schema: typeof SCHEMA_BACKUP;
  versioneSchema: number;
  versioneMotore: string;
  /** Data e ora di creazione in formato ISO 8601, fornita dall'app. */
  creatoIl: string;
}

/** Testo JSON del backup, da salvare o condividere come file. */
export function esportaBackup(dati: DatiBackup, creatoIl: string): string {
  const file: FileBackup = {
    schema: SCHEMA_BACKUP,
    versioneSchema: VERSIONE_SCHEMA_BACKUP,
    versioneMotore: VERSIONE_MOTORE,
    creatoIl,
    ...(dati.profilo ? { profilo: dati.profilo } : {}),
    fatture: dati.fatture,
    spese: dati.spese,
  };
  return JSON.stringify(file, null, 2);
}

export type EsitoImportBackup =
  | { ok: true; dati: DatiBackup; versioneSchema: number; versioneMotore: string; creatoIl: string }
  | { ok: false; errori: string[] };

const isOggetto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Legge e controlla un backup. Se c'è anche un solo errore non restituisce dati:
 * l'app non deve sovrascrivere l'archivio con un backup parziale.
 */
export function importaBackup(testo: string): EsitoImportBackup {
  let json: unknown;
  try {
    json = JSON.parse(testo.replace(/^﻿/, ''));
  } catch {
    return { ok: false, errori: ['Il file non è un backup di LumiaMed (non è un file JSON valido).'] };
  }
  if (!isOggetto(json) || json.schema !== SCHEMA_BACKUP) {
    return { ok: false, errori: ['Il file non è un backup di LumiaMed.'] };
  }
  const versione = json.versioneSchema;
  if (typeof versione !== 'number' || !Number.isInteger(versione) || versione < 1) {
    return { ok: false, errori: ['Il backup è danneggiato: versione non valida.'] };
  }
  if (versione > VERSIONE_SCHEMA_BACKUP) {
    return { ok: false, errori: ['Il backup è stato creato con una versione più recente di LumiaMed: aggiorna l\'app e riprova.'] };
  }
  if (!Array.isArray(json.fatture) || !Array.isArray(json.spese)) {
    return { ok: false, errori: ['Il backup è danneggiato: mancano le fatture o le spese.'] };
  }

  const errori: string[] = [];
  const idVisti = new Set<string>();
  const controllaId = (x: Record<string, unknown>, nome: string) => {
    if (typeof x.id !== 'string' || x.id === '') errori.push(`${nome}: manca l'identificativo.`);
    else if (idVisti.has(x.id)) errori.push(`${nome}: identificativo ripetuto (${x.id}).`);
    else idVisti.add(x.id);
  };
  json.fatture.forEach((f, i) => {
    const nome = `Fattura ${i + 1}`;
    if (!isOggetto(f)) { errori.push(`${nome}: dati non validi.`); return; }
    controllaId(f, nome);
    for (const err of validaFattura(f as unknown as Fattura).errori) errori.push(`${nome}${typeof f.numero === 'string' ? ` (n. ${f.numero})` : ''}: ${err.messaggio}`);
  });
  json.spese.forEach((s, i) => {
    const nome = `Spesa ${i + 1}`;
    if (!isOggetto(s)) { errori.push(`${nome}: dati non validi.`); return; }
    controllaId(s, nome);
    for (const err of validaSpesa(s as unknown as Spesa).errori) errori.push(`${nome}: ${err.messaggio}`);
  });
  if (json.profilo !== undefined) {
    if (!isOggetto(json.profilo)) errori.push('Profilo: dati non validi.');
    else for (const err of validaProfilo(json.profilo as unknown as Profilo).errori) errori.push(`Profilo: ${err.messaggio}`);
  }
  if (errori.length > 0) return { ok: false, errori };

  return {
    ok: true,
    dati: {
      ...(json.profilo !== undefined ? { profilo: json.profilo as unknown as Profilo } : {}),
      fatture: json.fatture as Fattura[],
      spese: json.spese as Spesa[],
    },
    versioneSchema: versione,
    versioneMotore: typeof json.versioneMotore === 'string' ? json.versioneMotore : '',
    creatoIl: typeof json.creatoIl === 'string' ? json.creatoIl : '',
  };
}
