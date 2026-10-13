import { describe, expect, it } from 'vitest';
import { getParametri } from '../params';
import { ricaviAnno } from '../movimenti';
import {
  anteprimaImportCsv, parseDataItaliana, storicoDaTotaleAnno, storicoDaTotaliMensili, type OpzioniStorico,
} from '../storico';

const opt: OpzioniStorico = { anno: 2026, oggi: '2026-06-20', trattamentoIva: 'forfettario_no_iva', prefissoId: 'st' };
const p = getParametri(2026).parametri;

describe('Storico — totali mese per mese', () => {
  it('un incasso per mese e una spesa per categoria, datati a fine mese (o oggi per il mese in corso)', () => {
    const r = storicoDaTotaliMensili([
      { mese: 2, incassi: 400_000, spese: { affitto_studio: 80_000, utenze: 0 } },
      { mese: 1, incassi: 300_000, ritenute: 60_000 },
      { mese: 6, incassi: 0, spese: { software: 5_000 } },
    ], opt);
    expect(r.errori).toEqual([]);
    expect(r.fatture.map((f) => [f.id, f.dataIncasso, f.imponibile, f.ritenutaAcconto, f.storico])).toEqual([
      ['st-2026-01', '2026-01-31', 300_000, 60_000, true],
      ['st-2026-02', '2026-02-28', 400_000, undefined, true],
    ]);
    expect(r.spese.map((s) => [s.id, s.data, s.categoria, s.importo, s.storico])).toEqual([
      ['st-2026-02-affitto_studio', '2026-02-28', 'affitto_studio', 80_000, true],
      ['st-2026-06-software', '2026-06-20', 'software', 5_000, true],
    ]);
    expect(r.fatture.every((f) => f.stato === 'incassata' && f.trattamentoIva === 'forfettario_no_iva' && !f.bolloAddebitato)).toBe(true);
    expect(ricaviAnno(r.fatture, 2026, p, '2026-06-20')).toBe(700_000);
  });

  it('errori: nessun movimento generato', () => {
    const r = storicoDaTotaliMensili([
      { mese: 13, incassi: 100 },
      { mese: 3, incassi: 100 },
      { mese: 3, incassi: 100 },
      { mese: 7, incassi: 100 },
      { mese: 4, incassi: 100, ritenute: 200 },
      { mese: 5, incassi: -100 },
      { mese: 1, incassi: 100, spese: { benzina: 100 } as never },
    ], opt);
    expect(r.fatture).toEqual([]);
    expect(r.spese).toEqual([]);
    expect(r.errori).toEqual([
      'Mese 13 non valido.',
      'Il mese di marzo è inserito due volte.',
      'Il mese di luglio 2026 non è ancora iniziato.',
      'Aprile: le ritenute superano gli incassi.',
      'Maggio: importo degli incassi non valido.',
      'Gennaio: categoria di spesa sconosciuta (benzina).',
    ]);
  });
});

describe('Storico — totale da inizio anno', () => {
  it('una sola cifra, datata oggi', () => {
    const r = storicoDaTotaleAnno({ incassi: 2_000_000, spese: { affitto_studio: 300_000 } }, opt);
    expect(r.fatture.map((f) => [f.id, f.dataIncasso, f.imponibile])).toEqual([['st-2026-totale', '2026-06-20', 2_000_000]]);
    expect(r.spese.map((s) => [s.id, s.data, s.importo])).toEqual([['st-2026-totale-affitto_studio', '2026-06-20', 300_000]]);
  });

  it('anno passato: al 31/12; anno futuro: errore', () => {
    expect(storicoDaTotaleAnno({ incassi: 100 }, { ...opt, anno: 2025 }).fatture[0].dataIncasso).toBe('2025-12-31');
    expect(storicoDaTotaleAnno({ incassi: 100 }, { ...opt, anno: 2027 }).errori).toEqual(['Il 2027 non è ancora iniziato.']);
  });
});

describe('Storico — import CSV', () => {
  const CSV = [
    'data;tipo;importo;categoria;descrizione',
    '15/01/2026;incasso;150,00;;Visita',
    '20/01/2026;Incasso;1.234,56;;',
    '',
    '03/02/2026;incasso;80;;',
    '05/02/2026;spesa;1.200,00;affitto_studio;Affitto febbraio',
    '10/02/2026;spesa;45,50;;Cancelleria',
    '31/02/2026;incasso;100;;',
    '15/03/2025;incasso;100;;',
    '15/12/2026;incasso;100;;',
    '15/03/2026;rimborso;100;;',
    '15/03/2026;spesa;abc;altro;',
    '15/03/2026;spesa;0;altro;',
    '15/03/2026;spesa;-10,00;altro;',
    '15/03/2026;spesa;10;benzina;',
    '15/03/2026;spesa;10;altro;x;extra',
    '15/03/2026;spesa;"10;altro',
  ].join('\r\n');

  it('anteprima: movimenti validi, righe scartate con il motivo', () => {
    const r = anteprimaImportCsv(CSV, opt);
    expect(r.errori).toEqual([]);
    expect(r.separatore).toBe(';');
    expect(r.righeLette).toBe(15);
    // Attesi: scripts/atteso_pacchetto_b.py
    expect(r.totaleIncassi).toBe(146_456);
    expect(r.totaleSpese).toBe(124_550);
    expect(r.fatture.map((f) => [f.id, f.dataIncasso, f.imponibile, f.tipoPrestazione])).toEqual([
      ['st-r2', '2026-01-15', 15_000, 'Visita'],
      ['st-r3', '2026-01-20', 123_456, undefined],
      ['st-r5', '2026-02-03', 8_000, undefined],
    ]);
    expect(r.spese.map((s) => [s.id, s.categoria, s.importo, s.descrizione])).toEqual([
      ['st-r6', 'affitto_studio', 120_000, 'Affitto febbraio'],
      ['st-r7', 'altro', 4_550, 'Cancelleria'],
    ]);
    expect([...r.fatture, ...r.spese].every((x) => x.storico)).toBe(true);
    expect(r.scartate.map((x) => [x.riga, x.motivo])).toEqual([
      [8, 'data non valida: usa gg/mm/aaaa'],
      [9, 'data fuori dal 2026'],
      [10, 'data futura'],
      [11, 'tipo non valido: usa "incasso" o "spesa"'],
      [12, 'importo non valido'],
      [13, 'l\'importo deve essere maggiore di zero'],
      [14, 'importo non valido'], // parseImporto rifiuta i negativi
      [15, 'categoria sconosciuta: benzina'],
      [16, 'più colonne dell\'intestazione'],
      [17, 'virgolette non chiuse'],
    ]);
    expect(r.scartate[0].testo).toBe('31/02/2026;incasso;100;;');
  });

  it('separatore virgola, BOM UTF-8 e importi tra virgolette', () => {
    const r = anteprimaImportCsv('﻿Data,Tipo,Importo\n15/01/2026,incasso,"1.234,56"\n16/01/2026,incasso,150,00\n17/01/2026,incasso,"il ""totale"""', opt);
    expect(r.separatore).toBe(',');
    expect(r.fatture.map((f) => f.imponibile)).toEqual([123_456]);
    expect(r.scartate.map((x) => [x.riga, x.motivo])).toEqual([
      [3, 'più colonne dell\'intestazione: con la virgola come separatore metti gli importi tra virgolette'],
      [4, 'importo non valido'],
    ]);
  });

  it('intestazione senza colonne obbligatorie o file vuoto: errore', () => {
    expect(anteprimaImportCsv('giorno;importo\n15/01/2026;10', opt).errori)
      .toEqual(['Nell\'intestazione manca la colonna "data", la colonna "tipo". Modello: data;tipo;importo;categoria;descrizione']);
    expect(anteprimaImportCsv('\n  \n', opt).errori).toEqual(['Il file è vuoto.']);
  });

  it('date gg/mm/aaaa', () => {
    expect(parseDataItaliana('1/2/2026')).toBe('2026-02-01');
    expect(parseDataItaliana('29/02/2028')).toBe('2028-02-29');
    expect(parseDataItaliana('29/02/2026')).toBeUndefined();
    expect(parseDataItaliana('2026-02-01')).toBeUndefined();
    expect(parseDataItaliana('15/13/2026')).toBeUndefined();
  });
});
