import { describe, expect, it } from 'vitest';
import type { Fattura, Profilo, Spesa } from '../types';
import { dataIsoValida, validaFattura, validaProfilo, validaSpesa } from '../validazione';

const fattura: Fattura = {
  id: 'f1', numero: '1', dataFattura: '2026-03-10', imponibile: 15_000, trattamentoIva: 'esente_art10',
  bolloAddebitato: true, destinatario: 'paziente', elettronica: false, stato: 'incassata', dataIncasso: '2026-03-10', origine: 'manuale',
};
const spesa: Spesa = { id: 's1', data: '2026-03-01', importo: 122_000, iva: 22_000, categoria: 'software' };
const profilo: Profilo = {
  regime: 'forfettario', dataNascita: '1990-05-10', annoInizioAttivita: 2020, requisitiStartup5: false,
  rateQuotaA: 1, rateQuotaB: 1, emetteFattureElettroniche: false,
};
const oggi = '2026-06-30';
const errori = (e: { errori: { campo: string; messaggio: string }[] }) => e.errori.map((x) => [x.campo, x.messaggio]);

describe('Date ISO', () => {
  it.each([['2026-02-28', true], ['2028-02-29', true], ['2026-02-29', false], ['2026-13-01', false], ['2026-1-01', false], ['', false]])(
    '%s -> %s', (iso, atteso) => expect(dataIsoValida(iso)).toBe(atteso),
  );
});

describe('validaFattura', () => {
  it('fattura corretta', () => {
    expect(validaFattura(fattura, oggi)).toEqual({ valido: true, errori: [] });
  });

  it('errori con il campo e il messaggio per l\'interfaccia', () => {
    const r = validaFattura({
      ...fattura, numero: ' ', imponibile: 0, iva: 500, bolloAddebitato: true, ritenutaAcconto: -1, dataIncasso: '2026-07-01',
    }, oggi);
    expect(r.valido).toBe(false);
    expect(errori(r)).toEqual([
      ['numero', 'Inserisci il numero della fattura.'],
      ['imponibile', 'L\'importo deve essere maggiore di zero.'],
      ['iva', 'Questa fattura è senza IVA: l\'IVA deve essere zero.'],
      ['ritenutaAcconto', 'Ritenuta non valida.'],
      ['dataIncasso', 'Data di incasso: la data è nel futuro.'],
    ]);
  });

  it('IVA, bollo, ritenuta e stato', () => {
    expect(errori(validaFattura({ ...fattura, trattamentoIva: 'imponibile_22', iva: 3_300, bolloAddebitato: true }))).toEqual([
      ['bolloAddebitato', 'Il bollo non è dovuto sulle fatture con IVA.'],
    ]);
    expect(errori(validaFattura({ ...fattura, ritenutaAcconto: 20_000 }))).toEqual([['ritenutaAcconto', 'La ritenuta non può superare l\'imponibile.']]);
    expect(errori(validaFattura({ ...fattura, dataIncasso: undefined }))).toEqual([['dataIncasso', 'Inserisci la data di incasso.']]);
    expect(errori(validaFattura({ ...fattura, stato: 'da_incassare' }))).toEqual([['dataIncasso', 'Una fattura da incassare non ha la data di incasso.']]);
    expect(errori(validaFattura({ ...fattura, dataFattura: '2026-02-30', imponibile: 10.5 }))).toEqual([
      ['dataFattura', 'Data della fattura: data non valida.'],
      ['imponibile', 'L\'importo deve essere maggiore di zero.'],
    ]);
  });

  it('la data della fattura può essere futura, quella di incasso no', () => {
    expect(validaFattura({ ...fattura, dataFattura: '2026-07-15', stato: 'da_incassare', dataIncasso: undefined }, oggi).valido).toBe(true);
  });
});

describe('validaSpesa', () => {
  it('spesa corretta', () => {
    expect(validaSpesa(spesa, oggi).valido).toBe(true);
  });

  it('importo, IVA, categoria, deducibilità, data futura', () => {
    expect(errori(validaSpesa({ ...spesa, importo: -100, iva: 200_000, categoria: 'benzina' as never, deducibilitaPersonalizzata: 1.5, data: '2026-08-01' }, oggi))).toEqual([
      ['data', 'Data del pagamento: la data è nel futuro.'],
      ['importo', 'L\'importo deve essere maggiore di zero.'],
      ['categoria', 'Scegli una categoria.'],
      ['deducibilitaPersonalizzata', 'La deducibilità deve essere tra 0% e 100%.'],
    ]);
    expect(errori(validaSpesa({ ...spesa, iva: 200_000 }))).toEqual([['iva', 'L\'IVA non può superare l\'importo pagato.']]);
  });

  it('riferimento dei versamenti F24 ed ENPAM', () => {
    expect(validaSpesa({ ...spesa, categoria: 'imposte_f24', riferimento: { tributo: 'imposta', anno: 2025, tipo: 'saldo' } }).valido).toBe(true);
    expect(errori(validaSpesa({ ...spesa, riferimento: { tributo: 'imposta', anno: 2025 } }))).toEqual([
      ['riferimento', 'Il riferimento si indica solo per i versamenti F24 ed ENPAM.'],
    ]);
    expect(errori(validaSpesa({ ...spesa, categoria: 'imposte_f24', riferimento: { tributo: 'enpam_quota_a', anno: 2027 } }))).toEqual([
      ['riferimento.tributo', 'Per un F24 scegli imposta, addizionale o IVA.'],
      ['riferimento.anno', 'Anno di riferimento non valido.'],
    ]);
    expect(errori(validaSpesa({ ...spesa, categoria: 'contributi_enpam', riferimento: { tributo: 'enpam_quota_b', anno: 2025, tipo: 'saldo' } }))).toEqual([
      ['riferimento.tipo', 'Saldo o acconto si indicano solo per imposte e addizionali.'],
    ]);
  });
});

describe('validaProfilo', () => {
  it('profilo corretto', () => {
    expect(validaProfilo(profilo, oggi).valido).toBe(true);
  });

  it('errori sui campi', () => {
    const r = validaProfilo({
      ...profilo, dataNascita: '2027-01-01', annoInizioAttivita: 2030, coefficienteRedditivita: 1.2, comuneCodiceCatastale: 'Roma',
      regione: 'XXX' as never, rateQuotaA: 3 as never, rateQuotaB: 4 as never, aliquotaQuotaB: 0.02 as never, redditiLavoroDipendenteAnnoPrecedente: -5,
    }, oggi);
    expect(errori(r)).toEqual([
      ['dataNascita', 'Data di nascita: la data è nel futuro.'],
      ['annoInizioAttivita', 'Anno di apertura della partita IVA non valido.'],
      ['coefficienteRedditivita', 'Il coefficiente di redditività deve essere tra 0% e 100%.'],
      ['comuneCodiceCatastale', 'Codice del comune non valido: scegli il comune dall\'elenco.'],
      ['regione', 'Scegli la regione dall\'elenco.'],
      ['rateQuotaA', 'Rate della Quota A: 1, 4 o 8.'],
      ['rateQuotaB', 'Rate della Quota B: 1, 2, 5 o 9.'],
      ['aliquotaQuotaB', 'Aliquota della Quota B: 19,5% oppure 9,75%.'],
      ['redditiLavoroDipendenteAnnoPrecedente', 'Importo non valido.'],
    ]);
  });

  it('dati dell\'anno precedente', () => {
    expect(validaProfilo({ ...profilo, annoPrecedente: { anno: 2025, impostaDifferenza: -5_000, redditoProfessionale: -100 } }, oggi).valido).toBe(true);
    expect(errori(validaProfilo({ ...profilo, annoPrecedente: { anno: 2024, impostaDifferenza: 1.5, ricavi: -1 } }, oggi))).toEqual([
      ['annoPrecedente.anno', 'I dati dell\'anno precedente devono riguardare il 2025.'],
      ['annoPrecedente.impostaDifferenza', 'Importo non valido.'],
      ['annoPrecedente.ricavi', 'Importo non valido.'],
    ]);
  });
});
