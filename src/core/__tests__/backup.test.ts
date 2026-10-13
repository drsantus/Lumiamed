import { describe, expect, it } from 'vitest';
import { esportaBackup, importaBackup, SCHEMA_BACKUP, VERSIONE_SCHEMA_BACKUP, type DatiBackup } from '../backup';
import { VERSIONE_MOTORE } from '../versione';

const dati: DatiBackup = {
  profilo: {
    regime: 'forfettario', dataNascita: '1990-05-10', annoInizioAttivita: 2020, requisitiStartup5: false,
    rateQuotaA: 1, rateQuotaB: 1, emetteFattureElettroniche: false,
  },
  fatture: [{
    id: 'f1', numero: '1', dataFattura: '2026-03-10', imponibile: 15_000, trattamentoIva: 'forfettario_no_iva', bolloAddebitato: true,
    destinatario: 'paziente', elettronica: false, stato: 'incassata', dataIncasso: '2026-03-10', origine: 'manuale', nomePaziente: 'Mario Rossi',
  }],
  spese: [{ id: 's1', data: '2026-03-01', importo: 80_000, categoria: 'affitto_studio', storico: true }],
};

describe('Versione del motore', () => {
  it('è in formato semver', () => {
    expect(VERSIONE_MOTORE).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('Backup', () => {
  it('esporta e reimporta gli stessi dati, con schema, versioni e data passata dall\'app', () => {
    const testo = esportaBackup(dati, '2026-10-13T12:00:00+02:00');
    const json = JSON.parse(testo);
    expect(json).toMatchObject({ schema: SCHEMA_BACKUP, versioneSchema: VERSIONE_SCHEMA_BACKUP, versioneMotore: VERSIONE_MOTORE, creatoIl: '2026-10-13T12:00:00+02:00' });
    const r = importaBackup(testo);
    expect(r).toEqual({ ok: true, dati, versioneSchema: 1, versioneMotore: VERSIONE_MOTORE, creatoIl: '2026-10-13T12:00:00+02:00' });
  });

  it('senza profilo e con il BOM all\'inizio', () => {
    const r = importaBackup(`﻿${esportaBackup({ fatture: [], spese: [] }, 'x')}`);
    expect(r).toMatchObject({ ok: true, dati: { fatture: [], spese: [] } });
  });

  it('file non validi', () => {
    expect(importaBackup('non è json')).toEqual({ ok: false, errori: ['Il file non è un backup di LumiaMed (non è un file JSON valido).'] });
    expect(importaBackup('{"fatture":[]}')).toEqual({ ok: false, errori: ['Il file non è un backup di LumiaMed.'] });
    expect(importaBackup(JSON.stringify({ schema: SCHEMA_BACKUP, versioneSchema: 'uno' }))).toEqual({ ok: false, errori: ['Il backup è danneggiato: versione non valida.'] });
    expect(importaBackup(JSON.stringify({ schema: SCHEMA_BACKUP, versioneSchema: VERSIONE_SCHEMA_BACKUP + 1, fatture: [], spese: [] })))
      .toEqual({ ok: false, errori: ['Il backup è stato creato con una versione più recente di LumiaMed: aggiorna l\'app e riprova.'] });
    expect(importaBackup(JSON.stringify({ schema: SCHEMA_BACKUP, versioneSchema: 1, fatture: [] })))
      .toEqual({ ok: false, errori: ['Il backup è danneggiato: mancano le fatture o le spese.'] });
  });

  it('valida ogni movimento e il profilo: con un solo errore non restituisce dati', () => {
    const json = JSON.parse(esportaBackup(dati, 'x'));
    json.fatture.push({ ...json.fatture[0], numero: '2', imponibile: -5 });
    json.spese.push({ ...json.spese[0] }, 'testo', { ...json.spese[0], id: '' });
    json.profilo.rateQuotaA = 3;
    const r = importaBackup(JSON.stringify(json));
    expect(r).toEqual({
      ok: false,
      errori: [
        'Fattura 2: identificativo ripetuto (f1).',
        'Fattura 2 (n. 2): L\'importo deve essere maggiore di zero.',
        'Spesa 2: identificativo ripetuto (s1).',
        'Spesa 3: dati non validi.',
        'Spesa 4: manca l\'identificativo.',
        'Profilo: Rate della Quota A: 1, 4 o 8.',
      ],
    });
  });
});
