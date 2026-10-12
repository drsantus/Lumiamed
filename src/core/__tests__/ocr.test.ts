import { describe, expect, it } from 'vitest';
import { parseImporto, parseInvoiceText } from '../ocr/parseInvoiceText';

describe('parseImporto', () => {
  it.each([
    ['150,00', 15_000],
    ['1.234,56', 123_456],
    ['€ 80', 8_000],
    ['1,234.56', 123_456],
    ['12.50', 1_250],
    ['2.000', 200_000],
  ])('%s -> %i', (raw, atteso) => {
    expect(parseImporto(raw)).toBe(atteso);
  });
});

const FATTURA_PAZIENTE = `
Dott.ssa Maria Bianchi
Medico Chirurgo - Specialista in Dermatologia
Via Roma 10, 09010 Portoscuso (SU)
P.IVA 01234567890
FATTURA N. 45/2026 del 12/03/2026
Spett.le RSSMRA80A01H501U
Visita dermatologica specialistica      150,00
Operazione esente IVA ai sensi dell'art. 10 n. 18 DPR 633/72
Marca da bollo assolta                    2,00
TOTALE DOCUMENTO € 152,00
`;

const FATTURA_FORFETTARIO = `
Dr. Luca Verdi
Fattura nr. 7 del 03-02-2026
Ecografia addominale
Compenso € 120,00
Operazione effettuata ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014 regime forfettario
Imposta di bollo 2,00
Totale da pagare 122,00
`;

const FATTURA_IVA = `
Fattura 12/A
Data: 15/04/2026
Perizia medico-legale
Imponibile 500,00
IVA 22% 110,00
Totale 610,00
`;

describe('parseInvoiceText', () => {
  it('fattura a paziente esente con bollo', () => {
    const r = parseInvoiceText(FATTURA_PAZIENTE);
    expect(r.numero?.valore).toBe('45/2026');
    expect(r.dataFattura?.valore).toBe('2026-03-12');
    expect(r.totale?.valore).toBe(15_200);
    expect(r.bollo?.valore).toBe(true);
    expect(r.trattamentoIva?.valore).toBe('esente_art10');
    expect(r.imponibile?.valore).toBe(15_000);
    expect(r.tipoPrestazione?.valore).toMatch(/Visita dermatologica/);
    expect(r.contieneCodiceFiscale).toBe(true);
    expect(JSON.stringify(r)).not.toContain('RSSMRA80A01H501U');
  });

  it('fattura forfettario', () => {
    const r = parseInvoiceText(FATTURA_FORFETTARIO);
    expect(r.numero?.valore).toBe('7');
    expect(r.dataFattura?.valore).toBe('2026-02-03');
    expect(r.imponibile?.valore).toBe(12_000);
    expect(r.totale?.valore).toBe(12_200);
    expect(r.trattamentoIva?.valore).toBe('forfettario_no_iva');
  });

  it('fattura con IVA 22%', () => {
    const r = parseInvoiceText(FATTURA_IVA);
    expect(r.numero?.valore).toBe('12/A');
    expect(r.dataFattura?.valore).toBe('2026-04-15');
    expect(r.imponibile?.valore).toBe(50_000);
    expect(r.totale?.valore).toBe(61_000);
    expect(r.trattamentoIva?.valore).toBe('imponibile_22');
    expect(r.bollo?.valore).toBe(false);
  });

  it('testo illeggibile: nessun crash e avvisi', () => {
    const r = parseInvoiceText('@@@ ### ...');
    expect(r.totale).toBeUndefined();
    expect(r.avvisi.length).toBeGreaterThan(0);
  });
});
