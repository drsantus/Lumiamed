import { isoYear, lastDayOfMonth } from './dates';
import type { Cents } from './money';
import { CATEGORIE_SPESA } from './storico';
import type { Fattura, IsoDate, Profilo, RegioneCode, Spesa, TributoVersamento } from './types';

/**
 * Controlli dei dati prima del salvataggio, con messaggi in italiano pronti per l'interfaccia.
 * `campo` è il nome del campo del tipo (es. "imponibile", "annoPrecedente.ricavi"): l'interfaccia
 * può mostrare il messaggio accanto al campo. `oggi` (facoltativo) abilita i controlli sulle date future.
 */
export interface ErroreValidazione {
  campo: string;
  messaggio: string;
}

export interface EsitoValidazione {
  valido: boolean;
  errori: ErroreValidazione[];
}

const esito = (errori: ErroreValidazione[]): EsitoValidazione => ({ valido: errori.length === 0, errori });

/** true se la stringa è una data reale "aaaa-mm-gg". */
export function dataIsoValida(iso: unknown): iso is IsoDate {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const m = Number(iso.slice(5, 7));
  const g = Number(iso.slice(8, 10));
  return m >= 1 && m <= 12 && g >= 1 && iso <= lastDayOfMonth(isoYear(iso), m);
}

const intero = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const importo = (v: unknown, min: Cents): boolean => intero(v) && v >= min;

const REGIONI: readonly RegioneCode[] = [
  'ABR', 'BAS', 'CAL', 'CAM', 'EMR', 'FVG', 'LAZ', 'LIG', 'LOM', 'MAR',
  'MOL', 'PIE', 'PUG', 'SAR', 'SIC', 'TOS', 'TAA_TN', 'TAA_BZ', 'UMB', 'VDA', 'VEN',
];
const TRIBUTI_F24: readonly TributoVersamento[] = ['imposta', 'addizionale_regionale', 'addizionale_comunale', 'iva'];
const TRIBUTI_ENPAM: readonly TributoVersamento[] = ['enpam_quota_a', 'enpam_quota_b'];

function controllaData(errori: ErroreValidazione[], campo: string, valore: unknown, nome: string, oggi?: IsoDate, futuraAmmessa = false) {
  if (!dataIsoValida(valore)) errori.push({ campo, messaggio: `${nome}: data non valida.` });
  else if (oggi && !futuraAmmessa && valore > oggi) errori.push({ campo, messaggio: `${nome}: la data è nel futuro.` });
}

export function validaFattura(f: Fattura, oggi?: IsoDate): EsitoValidazione {
  const errori: ErroreValidazione[] = [];
  const e = (campo: string, messaggio: string) => errori.push({ campo, messaggio });
  if (typeof f.numero !== 'string' || !f.numero.trim()) e('numero', 'Inserisci il numero della fattura.');
  controllaData(errori, 'dataFattura', f.dataFattura, 'Data della fattura', oggi, true);
  if (!importo(f.imponibile, 1)) e('imponibile', 'L\'importo deve essere maggiore di zero.');
  if (!['esente_art10', 'imponibile_22', 'forfettario_no_iva'].includes(f.trattamentoIva)) e('trattamentoIva', 'Scegli il trattamento IVA.');
  if (f.iva !== undefined) {
    if (!importo(f.iva, 0)) e('iva', 'IVA non valida.');
    else if (f.trattamentoIva !== 'imponibile_22' && f.iva > 0) e('iva', 'Questa fattura è senza IVA: l\'IVA deve essere zero.');
  }
  if (f.bolloAddebitato && f.trattamentoIva === 'imponibile_22') e('bolloAddebitato', 'Il bollo non è dovuto sulle fatture con IVA.');
  if (f.ritenutaAcconto !== undefined) {
    if (!importo(f.ritenutaAcconto, 0)) e('ritenutaAcconto', 'Ritenuta non valida.');
    else if (importo(f.imponibile, 1) && f.ritenutaAcconto > f.imponibile) e('ritenutaAcconto', 'La ritenuta non può superare l\'imponibile.');
  }
  if (f.stato === 'incassata') {
    if (f.dataIncasso === undefined) e('dataIncasso', 'Inserisci la data di incasso.');
    else controllaData(errori, 'dataIncasso', f.dataIncasso, 'Data di incasso', oggi);
  } else if (f.stato === 'da_incassare') {
    if (f.dataIncasso !== undefined) e('dataIncasso', 'Una fattura da incassare non ha la data di incasso.');
  } else {
    e('stato', 'Indica se la fattura è incassata.');
  }
  if (f.destinatario !== 'paziente' && f.destinatario !== 'struttura') e('destinatario', 'Indica se la fattura è per un paziente o per una struttura.');
  return esito(errori);
}

export function validaSpesa(s: Spesa, oggi?: IsoDate): EsitoValidazione {
  const errori: ErroreValidazione[] = [];
  const e = (campo: string, messaggio: string) => errori.push({ campo, messaggio });
  controllaData(errori, 'data', s.data, 'Data del pagamento', oggi);
  if (!importo(s.importo, 1)) e('importo', 'L\'importo deve essere maggiore di zero.');
  if (s.iva !== undefined) {
    if (!importo(s.iva, 0)) e('iva', 'IVA non valida.');
    else if (importo(s.importo, 1) && s.iva > s.importo) e('iva', 'L\'IVA non può superare l\'importo pagato.');
  }
  if (!CATEGORIE_SPESA.includes(s.categoria)) e('categoria', 'Scegli una categoria.');
  if (s.deducibilitaPersonalizzata !== undefined
    && !(typeof s.deducibilitaPersonalizzata === 'number' && s.deducibilitaPersonalizzata >= 0 && s.deducibilitaPersonalizzata <= 1)) {
    e('deducibilitaPersonalizzata', 'La deducibilità deve essere tra 0% e 100%.');
  }
  const rif = s.riferimento;
  if (rif) {
    const ammessi = s.categoria === 'imposte_f24' ? TRIBUTI_F24 : s.categoria === 'contributi_enpam' ? TRIBUTI_ENPAM : [];
    if (ammessi.length === 0) e('riferimento', 'Il riferimento si indica solo per i versamenti F24 ed ENPAM.');
    else if (!ammessi.includes(rif.tributo)) {
      e('riferimento.tributo', s.categoria === 'imposte_f24' ? 'Per un F24 scegli imposta, addizionale o IVA.' : 'Per un versamento ENPAM scegli Quota A o Quota B.');
    }
    if (!intero(rif.anno) || rif.anno < 2000 || (dataIsoValida(s.data) && rif.anno > isoYear(s.data))) {
      e('riferimento.anno', 'Anno di riferimento non valido.');
    }
    if (rif.tipo !== undefined && !['imposta', 'addizionale_regionale', 'addizionale_comunale'].includes(rif.tributo)) {
      e('riferimento.tipo', 'Saldo o acconto si indicano solo per imposte e addizionali.');
    }
  }
  return esito(errori);
}

export function validaProfilo(p: Profilo, oggi?: IsoDate): EsitoValidazione {
  const errori: ErroreValidazione[] = [];
  const e = (campo: string, messaggio: string) => errori.push({ campo, messaggio });
  if (p.regime !== 'forfettario' && p.regime !== 'ordinario') e('regime', 'Scegli il regime fiscale.');
  controllaData(errori, 'dataNascita', p.dataNascita, 'Data di nascita', oggi);
  if (!intero(p.annoInizioAttivita) || p.annoInizioAttivita < 1950 || (oggi && p.annoInizioAttivita > isoYear(oggi))) {
    e('annoInizioAttivita', 'Anno di apertura della partita IVA non valido.');
  } else if (dataIsoValida(p.dataNascita) && p.annoInizioAttivita < isoYear(p.dataNascita)) {
    e('annoInizioAttivita', 'L\'anno di apertura è prima della data di nascita.');
  }
  if (p.coefficienteRedditivita !== undefined && !(p.coefficienteRedditivita > 0 && p.coefficienteRedditivita <= 1)) {
    e('coefficienteRedditivita', 'Il coefficiente di redditività deve essere tra 0% e 100%.');
  }
  if (p.comuneCodiceCatastale !== undefined && !/^[A-Z]\d{3}$/i.test(p.comuneCodiceCatastale)) {
    e('comuneCodiceCatastale', 'Codice del comune non valido: scegli il comune dall\'elenco.');
  }
  if (p.regione !== undefined && !REGIONI.includes(p.regione)) e('regione', 'Scegli la regione dall\'elenco.');
  if (![1, 4, 8].includes(p.rateQuotaA)) e('rateQuotaA', 'Rate della Quota A: 1, 4 o 8.');
  if (![1, 2, 5, 9].includes(p.rateQuotaB)) e('rateQuotaB', 'Rate della Quota B: 1, 2, 5 o 9.');
  if (p.aliquotaQuotaB !== undefined && p.aliquotaQuotaB !== 0.195 && p.aliquotaQuotaB !== 0.0975) {
    e('aliquotaQuotaB', 'Aliquota della Quota B: 19,5% oppure 9,75%.');
  }
  if (p.redditiLavoroDipendenteAnnoPrecedente !== undefined && !importo(p.redditiLavoroDipendenteAnnoPrecedente, 0)) {
    e('redditiLavoroDipendenteAnnoPrecedente', 'Importo non valido.');
  }
  if (p.redditoLavoroDipendente !== undefined && !importo(p.redditoLavoroDipendente, 0)) e('redditoLavoroDipendente', 'Importo non valido.');
  const prec = p.annoPrecedente;
  if (prec) {
    if (!intero(prec.anno) || (oggi && prec.anno !== isoYear(oggi) - 1)) {
      e('annoPrecedente.anno', oggi ? `I dati dell'anno precedente devono riguardare il ${isoYear(oggi) - 1}.` : 'Anno non valido.');
    }
    // Il rigo differenza e il reddito professionale possono essere negativi (credito, perdita).
    if (!intero(prec.impostaDifferenza)) e('annoPrecedente.impostaDifferenza', 'Importo non valido.');
    if (prec.redditoProfessionale !== undefined && !intero(prec.redditoProfessionale)) e('annoPrecedente.redditoProfessionale', 'Importo non valido.');
    for (const k of ['addizionaleComunale', 'ricavi', 'accontiVersati', 'ritenute', 'addizionaleRegionale', 'accontoAddizionaleComunaleVersato'] as const) {
      if (prec[k] !== undefined && !importo(prec[k], 0)) e(`annoPrecedente.${k}`, 'Importo non valido.');
    }
  }
  return esito(errori);
}
