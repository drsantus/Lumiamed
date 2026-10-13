import { describe, expect, it } from 'vitest';
import { easterSunday, etaAl, isGiornoLavorativo, primoGiornoLavorativo } from '../dates';
import { euro } from '../money';
import { getParametri } from '../params';
import { generaScadenziario, scadenzeProssimi12Mesi } from '../scadenziario';

const p = getParametri(2026).parametri;

describe('Calendario', () => {
  it('Pasqua', () => {
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });

  it('slittamento al primo giorno lavorativo', () => {
    expect(primoGiornoLavorativo('2026-01-31')).toBe('2026-02-02'); // sabato
    expect(primoGiornoLavorativo('2026-10-31')).toBe('2026-11-02'); // sabato + Ognissanti domenica
    expect(primoGiornoLavorativo('2026-04-06')).toBe('2026-04-07'); // Pasquetta
    expect(primoGiornoLavorativo('2026-07-20')).toBe('2026-07-20'); // lunedì
  });

  // Attesi: scripts/atteso_pacchetto_c.py
  it('4 ottobre festivo dal 2026', () => {
    expect(isGiornoLavorativo('2024-10-04')).toBe(true); // venerdì, prima del 2026
    expect(isGiornoLavorativo('2027-10-04')).toBe(false); // lunedì
    expect(primoGiornoLavorativo('2027-10-04')).toBe('2027-10-05');
    expect(primoGiornoLavorativo('2028-10-04')).toBe('2028-10-05'); // mercoledì
  });

  it('età compiuta', () => {
    expect(etaAl('1996-03-15', '2026-03-14')).toBe(29);
    expect(etaAl('1996-03-15', '2026-03-15')).toBe(30);
  });
});

describe('Scadenziario 2026', () => {
  const base = { rateQuotaA: 1 as const, rateQuotaB: 1 as const, emetteFattureElettroniche: false };

  it('forfettario con Quota A e B in unica soluzione', () => {
    const s = generaScadenziario({ anno: 2026, profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false }, p);
    const byId = Object.fromEntries(s.map((x) => [x.id, x]));
    expect(byId.sts.data).toBe('2026-02-02');
    expect(byId['quotaA-1'].data).toBe('2026-04-30');
    expect(byId.modelloD.data).toBe('2026-07-31');
    expect(byId['saldo-primo-acconto'].data).toBe('2026-07-20');
    expect(byId['quotaB-1'].data).toBe('2026-10-31'); // ENPAM: nessuno slittamento (31/10/2026 è sabato)
    expect(byId['secondo-acconto'].data).toBe('2026-11-30');
    expect(s.some((x) => x.categoria === 'iva')).toBe(false);
    // ordinate per data
    expect([...s].sort((a, b) => a.data.localeCompare(b.data)).map((x) => x.id)).toEqual(s.map((x) => x.id));
  });

  it('rate Quota A e B con importi divisi senza perdere centesimi', () => {
    const s = generaScadenziario({
      anno: 2026,
      profilo: { regime: 'forfettario', rateQuotaA: 8, rateQuotaB: 9, emetteFattureElettroniche: false },
      haOperazioniIva: false,
      importi: { quotaA: euro(592.94), quotaB: euro(5_021.88), quotaBCicloPrecedente: euro(4_500) },
    }, p);
    const a = s.filter((x) => x.id.startsWith('quotaA-'));
    expect(a).toHaveLength(8);
    expect(a.reduce((t, x) => t + (x.importoStimato ?? 0), 0)).toBe(euro(592.94));
    const b = s.filter((x) => x.id.startsWith('quotaB-') && !x.id.startsWith('quotaB-prec'));
    expect(b).toHaveLength(3); // ottobre, novembre, dicembre 2026
    const prec = s.filter((x) => x.id.startsWith('quotaB-prec'));
    expect(prec).toHaveLength(6); // gennaio-giugno 2026 del ciclo precedente
  });

  it('ordinario con IVA e fatture elettroniche', () => {
    const s = generaScadenziario({
      anno: 2026,
      profilo: { regime: 'ordinario', ...base, emetteFattureElettroniche: true },
      haOperazioniIva: true,
    }, p);
    const byId = Object.fromEntries(s.map((x) => [x.id, x]));
    expect(byId['iva-t1'].data).toBe('2026-05-18'); // 16 maggio sabato
    expect(byId['iva-t2'].data).toBe('2026-08-20');
    expect(byId['iva-acconto'].data).toBe('2026-12-28'); // 27 dicembre domenica
    expect(byId['bollo-t1'].data).toBe('2026-06-01'); // 31 maggio domenica
  });

  it('anno senza parametri: date standard', () => {
    const p28 = getParametri(2028).parametri;
    const s = generaScadenziario({ anno: 2028, profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false }, p28);
    const saldo = s.find((x) => x.id === 'saldo-primo-acconto');
    expect(saldo?.dataNominale).toBe('2028-06-30');
    expect(saldo?.descrizione).toContain('data standard');
  });

  it('dichiarazione 31/10/2026 (sabato) → lunedì 2/11; le scadenze ENPAM non slittano', () => {
    const s = generaScadenziario({ anno: 2026, profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false }, p);
    const byId = Object.fromEntries(s.map((x) => [x.id, x]));
    expect(byId.dichiarazione).toMatchObject({ dataNominale: '2026-10-31', data: '2026-11-02', anno: 2026 });
    expect(byId['quotaB-1']).toMatchObject({ dataNominale: '2026-10-31', data: '2026-10-31' });
    expect(s.filter((x) => x.categoria === 'enpam' || x.id === 'modelloD').every((x) => x.data === x.dataNominale)).toBe(true);
  });

  it('finestra di 12 mesi: dal 15/12 compaiono il Sistema TS e le rate di gennaio dell\'anno dopo', () => {
    const s = scadenzeProssimi12Mesi({
      oggi: '2026-12-15', profilo: { regime: 'forfettario', rateQuotaA: 1, rateQuotaB: 9, emetteFattureElettroniche: false },
      haOperazioniIva: false, importi: { quotaB: 500_000 },
    });
    expect(s.map((x) => [x.id, x.anno, x.data])).toEqual([
      ['quotaB-3', 2026, '2026-12-31'],
      ['quotaB-prec-4', 2027, '2027-01-31'],
      ['sts', 2027, '2027-02-01'],
      ['quotaB-prec-5', 2027, '2027-02-28'],
      ['quotaB-prec-6', 2027, '2027-03-31'],
      ['quotaA-1', 2027, '2027-04-30'],
      ['quotaB-prec-7', 2027, '2027-04-30'],
      ['quotaB-prec-8', 2027, '2027-05-31'],
      ['quotaB-prec-9', 2027, '2027-06-30'],
      ['saldo-primo-acconto', 2027, '2027-06-30'],
      ['modelloD', 2027, '2027-07-31'],
      ['quotaB-1', 2027, '2027-10-31'],
      ['dichiarazione', 2027, '2027-11-02'],
      ['quotaB-2', 2027, '2027-11-30'],
      ['secondo-acconto', 2027, '2027-11-30'],
    ]);
    // Le rate di gennaio-giugno 2027 sono dello stesso ciclo della Quota B pagata da ottobre 2026
    expect(s.find((x) => x.id === 'quotaB-prec-4')?.importoStimato).toBe(55_555);
    expect(s.find((x) => x.id === 'quotaB-prec-9')?.importoStimato).toBe(55_560);
    expect(s.find((x) => x.id === 'quotaB-3')?.importoStimato).toBe(55_555);
  });

  it('finestra di 12 mesi: oggi incluso, stesso giorno dell\'anno dopo escluso', () => {
    const daSaldo = scadenzeProssimi12Mesi({ oggi: '2026-07-20', profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false });
    expect(daSaldo[0]).toMatchObject({ id: 'saldo-primo-acconto', anno: 2026, data: '2026-07-20' });
    const s = scadenzeProssimi12Mesi({ oggi: '2026-06-30', profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false });
    expect(s.some((x) => x.anno === 2027 && x.id === 'saldo-primo-acconto')).toBe(false); // 30/6/2027: escluso
    expect(s.some((x) => x.anno === 2027 && x.id === 'quotaA-1')).toBe(true); // 30/4/2027
  });

  it('2027: parametri provvisori con le date standard', () => {
    const s = generaScadenziario({ anno: 2027, profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false }, getParametri(2027).parametri);
    expect(s.find((x) => x.id === 'saldo-primo-acconto')?.dataNominale).toBe('2027-06-30');
    expect(s.find((x) => x.id === 'sts')?.dataNominale).toBe('2027-01-31');
  });
});
