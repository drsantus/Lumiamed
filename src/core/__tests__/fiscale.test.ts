import { describe, expect, it } from 'vitest';
import { pianoAcconti, confrontaAcconti, proiezioneAnnua } from '../acconti';
import { addizionaleComunale, addizionaleRegionale, type TabelleAddizionali } from '../addizionali';
import { quotaA, quotaB } from '../enpam';
import { aliquotaForfettario, calcolaForfettario } from '../forfettario';
import { euro } from '../money';
import { calcolaOrdinario, detrazioneLavoroAutonomo, speseDeducibili } from '../ordinario';
import { getParametri } from '../params';
import { impostaProgressiva } from '../scaglioni';
import type { Spesa } from '../types';
import { SCENARI_ACCONTI, SCENARI_FORFETTARIO, SCENARI_ORDINARIO, SCENARI_QUOTA_A, SCENARI_QUOTA_B } from './scenari';

const p = getParametri(2026).parametri;

export const TABELLE_PROVA: TabelleAddizionali = {
  regionali: {
    LAZ: {
      regione: 'LAZ', anno: 2026, fonte: 'prova',
      scaglioni: [
        { fino: euro(15_000), aliquota: 0.0173 },
        { fino: euro(28_000), aliquota: 0.0273 },
        { fino: euro(50_000), aliquota: 0.0293 },
        { fino: null, aliquota: 0.0333 },
      ],
    },
  },
  comunali: {
    H501: {
      codiceCatastale: 'H501', comune: 'Roma', provincia: 'RM', anno: 2026,
      aliquotaUnica: 0.008, esenzione: { soglia: euro(10_000), tipo: 'esclusione' },
    },
  },
};

describe('Forfettario — scenari validati dal commercialista', () => {
  it.each(SCENARI_FORFETTARIO)('$id: $descrizione', (s) => {
    const r = calcolaForfettario({
      anno: s.input.anno,
      ricavi: s.input.ricavi,
      contributiVersati: s.input.contributiVersati,
      profilo: { annoInizioAttivita: s.input.annoInizioAttivita, requisitiStartup5: s.input.requisitiStartup5 },
    }, p);
    expect(r.redditoLordo).toBe(s.atteso.redditoLordo);
    expect(r.imponibile).toBe(s.atteso.imponibile);
    expect(r.aliquota).toBe(s.atteso.aliquota);
    expect(r.impostaSostitutiva).toBe(s.atteso.impostaSostitutiva);
  });

  it('5% solo nei primi 5 anni e solo con i requisiti', () => {
    const prof = { annoInizioAttivita: 2022, requisitiStartup5: true };
    expect(aliquotaForfettario(2026, prof, p)).toBe(0.05);
    expect(aliquotaForfettario(2027, prof, p)).toBe(0.15);
    expect(aliquotaForfettario(2026, { ...prof, requisitiStartup5: false }, p)).toBe(0.15);
  });

  it('avvisa oltre 85.000 € e oltre 100.000 €', () => {
    const prof = { annoInizioAttivita: 2020, requisitiStartup5: false };
    const a = calcolaForfettario({ anno: 2026, ricavi: euro(90_000), contributiVersati: 0, profilo: prof }, p);
    expect(a.avvisi.map((x) => x.codice)).toContain('FORF_USCITA_ANNO_PROSSIMO');
    const b = calcolaForfettario({ anno: 2026, ricavi: euro(105_000), contributiVersati: 0, profilo: prof }, p);
    expect(b.avvisi.map((x) => x.codice)).toContain('FORF_USCITA_IMMEDIATA');
    const c = calcolaForfettario({ anno: 2026, ricavi: euro(80_000), contributiVersati: 0, profilo: prof }, p);
    expect(c.avvisi.map((x) => x.codice)).toContain('FORF_VICINO_LIMITE');
  });

  it('contributi eccedenti il reddito: imponibile zero e avviso', () => {
    const r = calcolaForfettario({ anno: 2026, ricavi: euro(5_000), contributiVersati: euro(5_000), profilo: { annoInizioAttivita: 2025, requisitiStartup5: true } }, p);
    expect(r.contributiEccedenti).toBe(euro(1_100));
    expect(r.avvisi.map((x) => x.codice)).toContain('FORF_CONTRIBUTI_ECCEDENTI');
  });
});

describe('IRPEF — scaglioni 2026 (23% / 33% / 43%)', () => {
  it.each([
    [0, 0],
    [euro(28_000), euro(6_440)],
    [euro(40_000), euro(10_400)],
    [euro(50_000), euro(13_700)],
    [euro(60_000), euro(18_000)],
  ])('imponibile %i -> imposta lorda %i', (imponibile, atteso) => {
    expect(impostaProgressiva(imponibile, p.irpef.scaglioni).totale).toBe(atteso);
  });

  it.each([
    [euro(5_000), euro(1_265)],
    [euro(5_500), euro(1_265)],
    [euro(20_000), euro(772)],
    [euro(28_000), euro(500)],
    [euro(35_000), euro(340.91)],
    [euro(50_000), 0],
    [euro(60_000), 0],
  ])('detrazione lavoro autonomo: reddito %i -> %i', (reddito, atteso) => {
    expect(detrazioneLavoroAutonomo(reddito, p)).toBe(atteso);
  });
});

describe('Ordinario — scenari validati dal commercialista', () => {
  it.each(SCENARI_ORDINARIO)('$id: $descrizione', (s) => {
    const spese: Spesa[] = s.input.spese.map((x, i) => ({ id: `s${i}`, data: '2026-03-01', ...x }));
    const r = calcolaOrdinario({
      anno: 2026,
      compensi: s.input.compensi,
      spese,
      contributiVersati: s.input.contributiVersati,
      ritenuteSubite: s.input.ritenute,
      profilo: { regione: 'LAZ', comuneCodiceCatastale: 'H501' },
      tabelleAddizionali: TABELLE_PROVA,
    }, p);
    expect(r.speseDeducibili).toBe(s.atteso.speseDeducibili);
    expect(r.redditoProfessionale).toBe(s.atteso.redditoProfessionale);
    expect(r.imponibile).toBe(s.atteso.imponibile);
    expect(r.impostaLorda).toBe(s.atteso.impostaLorda);
    expect(r.detrazioneLavoroAutonomo).toBe(s.atteso.detrazioneLavoroAutonomo);
    expect(r.impostaNetta).toBe(s.atteso.impostaNetta);
    expect(r.addizionaleRegionale).toBe(s.atteso.addizionaleRegionaleProva);
    expect(r.addizionaleComunale).toBe(s.atteso.addizionaleComunaleProva);
    expect(r.differenza).toBe(s.atteso.impostaNetta - s.input.ritenute);
  });

  it('senza IRPEF netta le addizionali non sono dovute', () => {
    const r = calcolaOrdinario({
      anno: 2026, compensi: euro(5_000), spese: [], contributiVersati: 0, ritenuteSubite: 0,
      profilo: { regione: 'LAZ', comuneCodiceCatastale: 'H501' }, tabelleAddizionali: TABELLE_PROVA,
    }, p);
    expect(r.impostaNetta).toBe(0);
    expect(r.addizionaleRegionale).toBe(0);
    expect(r.addizionaleComunale).toBe(0);
  });

  it('formazione limitata a 10.000 € e IVA detratta esclusa dal costo', () => {
    const r = speseDeducibili([
      { id: '1', data: '2026-01-10', importo: euro(12_000), categoria: 'formazione_ecm' },
      { id: '2', data: '2026-01-10', importo: euro(1_220), iva: euro(220), categoria: 'software' },
    ], euro(50_000), p, 0.5);
    expect(r.perCategoria.formazione_ecm?.deducibile).toBe(euro(10_000));
    expect(r.perCategoria.software?.deducibile).toBe(euro(1_110));
  });

  it('segnala le attrezzature da ammortizzare', () => {
    const r = speseDeducibili([{ id: '1', data: '2026-02-01', importo: euro(3_000), categoria: 'attrezzature', descrizione: 'Ecografo' }], euro(50_000), p);
    expect(r.avvisi[0].codice).toBe('SPESA_AMMORTAMENTO');
  });
});

describe('Addizionali', () => {
  it('regione non in tabella: aliquota base 1,23% e avviso', () => {
    const r = addizionaleRegionale(euro(10_000), 'SAR', { regionali: {}, comunali: {} });
    expect(r.importo).toBe(euro(123));
    expect(r.avvisi[0].codice).toBe('ADD_REG_NON_TROVATA');
  });

  it('comunale: esclusione sotto soglia e franchigia', () => {
    expect(addizionaleComunale(euro(9_000), 'H501', TABELLE_PROVA).importo).toBe(0);
    const franchigia: TabelleAddizionali = {
      regionali: {},
      comunali: { X000: { codiceCatastale: 'X000', comune: 'Prova', provincia: 'PR', anno: 2026, aliquotaUnica: 0.008, esenzione: { soglia: euro(10_000), tipo: 'franchigia' } } },
    };
    expect(addizionaleComunale(euro(20_000), 'x000', franchigia).importo).toBe(euro(80));
  });
});

describe('ENPAM', () => {
  it.each(SCENARI_QUOTA_A)('Quota A $id: $descrizione', (s) => {
    expect(quotaA(s.input.anno, s.input.dataNascita, p).totale).toBe(s.atteso.totale);
  });

  it.each(SCENARI_QUOTA_B)('Quota B $id: $descrizione', (s) => {
    const r = quotaB(s.input.annoReddito, s.input.redditoProfessionale, s.input.dataNascita, p);
    expect(r.soglia).toBe(s.atteso.soglia);
    expect(r.totale).toBe(s.atteso.totale);
  });
});

describe('Acconti', () => {
  it.each(SCENARI_ACCONTI)('$id: $descrizione', (s) => {
    const r = pianoAcconti(s.input.base, p);
    expect(r.modalita).toBe(s.atteso.modalita);
    expect(r.primaRata).toBe(s.atteso.primaRata);
    expect(r.secondaRata).toBe(s.atteso.secondaRata);
    expect(r.primaRata + r.secondaRata).toBe(r.totale);
  });

  it('rate dispari: la somma resta esatta', () => {
    const r = pianoAcconti(143_501, p);
    expect(r.primaRata + r.secondaRata).toBe(143_501);
  });

  it('previsionale conviene se quest\'anno si guadagna meno', () => {
    const c = confrontaAcconti(euro(5_000), euro(3_000), p);
    expect(c.risparmioPrevisionale).toBe(euro(2_000));
    expect(c.avvisi[0].codice).toBe('ACCONTI_PREVISIONALE_CONVIENE');
  });

  it('proiezione lineare a metà anno', () => {
    const pr = proiezioneAnnua(euro(10_000), '2026-07-02'); // 183° giorno
    expect(pr.affidabile).toBe(true);
    expect(pr.valoreAnnuo).toBe(Math.round(euro(10_000) / (183 / 365)));
    expect(proiezioneAnnua(euro(1_000), '2026-01-20').affidabile).toBe(false);
  });
});

describe('Parametri', () => {
  it('anno non in tabella: usa il più vicino e lo segnala', () => {
    const r = getParametri(2027);
    expect(r.approssimati).toBe(true);
    expect(r.parametri.anno).toBe(2027);
    expect(r.parametri.irpef.scaglioni).toEqual(p.irpef.scaglioni);
  });
});

describe('Tabella comunale precaricata (dati MEF)', () => {
  it('contiene migliaia di comuni', async () => {
    const { tabelleCaricate } = await import('../addizionali');
    expect(tabelleCaricate().comuni).toBeGreaterThan(3000);
  });

  it('Abbadia San Salvatore: 0,6% con esenzione fino a 12.000 €', () => {
    expect(addizionaleComunale(euro(20_000), 'A006').importo).toBe(euro(120));
    expect(addizionaleComunale(euro(11_000), 'A006').importo).toBe(0);
  });

  it('Abbadia Lariana: scaglioni 0,76% / 0,77% / 0,8% con esenzione 15.000 €', () => {
    // 28.000 × 0,76% + 12.000 × 0,77% = 212,80 + 92,40
    expect(addizionaleComunale(euro(40_000), 'A005').importo).toBe(euro(305.2));
  });
});

describe('Tabella regionale precaricata (dati MEF 2026)', () => {
  it('Sardegna: 1,23% unica', () => {
    expect(addizionaleRegionale(euro(40_000), 'SAR').importo).toBe(euro(492));
  });
  it('Lombardia: progressiva 1,23 / 1,58 / 1,72 / 1,73', () => {
    // 15.000×1,23% + 13.000×1,58% + 12.000×1,72% = 184,50 + 205,40 + 206,40
    expect(addizionaleRegionale(euro(40_000), 'LOM').importo).toBe(euro(596.3));
  });
  it('Friuli VG: 0,70% su tutto fino a 15.000, poi 1,23% su tutto', () => {
    expect(addizionaleRegionale(euro(15_000), 'FVG').importo).toBe(euro(105));
    expect(addizionaleRegionale(euro(20_000), 'FVG').importo).toBe(euro(246));
  });
  it('Lazio: 1,73% su tutto fino a 28.000; detrazione 60 € tra 28.000 e 30.000', () => {
    expect(addizionaleRegionale(euro(28_000), 'LAZ').importo).toBe(euro(484.4));
    // 15.000×1,73% + 14.000×3,33% − 60 = 259,50 + 466,20 − 60
    expect(addizionaleRegionale(euro(29_000), 'LAZ').importo).toBe(euro(665.7));
  });
  it("Valle d'Aosta: esente fino a 15.000, poi 1,23% su tutto", () => {
    expect(addizionaleRegionale(euro(15_000), 'VDA').importo).toBe(0);
    expect(addizionaleRegionale(euro(20_000), 'VDA').importo).toBe(euro(246));
  });
  it('tutte le 21 regioni/province presenti', async () => {
    const { tabelleCaricate } = await import('../addizionali');
    expect(tabelleCaricate().regioni).toBe(21);
  });
});
