import { describe, expect, it } from 'vitest';
import { easterSunday, etaAl, primoGiornoLavorativo } from '../dates';
import { euro } from '../money';
import { getParametri } from '../params';
import { generaScadenziario } from '../scadenziario';

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
    expect(byId['quotaB-1'].data).toBe('2026-11-02');
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
    const p27 = getParametri(2027).parametri;
    const s = generaScadenziario({ anno: 2027, profilo: { regime: 'forfettario', ...base }, haOperazioniIva: false }, p27);
    expect(s.find((x) => x.id === 'saldo-primo-acconto')?.dataNominale).toBe('2027-06-30');
  });
});
