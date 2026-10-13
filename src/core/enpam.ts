import { etaAl, lastDayOfMonth, ymd } from './dates';
import { clampMin0, pct, type Cents } from './money';
import type { ParametriAnno } from './params';
import type { IsoDate } from './types';

export interface DettaglioQuotaA {
  totale: Cents;
  contributoBase: Cents;
  contributoMaternita: Cents;
  /** Importo mensile applicato, mese per mese (1 = gennaio). */
  mesi: { mese: number; eta: number; importo: Cents }[];
}

function importoAnnuoPerEta(eta: number, p: ParametriAnno): Cents {
  const fascia = p.enpam.quotaA.fasce.find((f) => f.finoEta === null || eta <= f.finoEta);
  return (fascia ?? p.enpam.quotaA.fasce[p.enpam.quotaA.fasce.length - 1]).importoAnnuo;
}

/**
 * Quota A dell'anno. La fascia più alta si applica dal mese successivo al compimento
 * dell'età, quindi l'importo è calcolato mese per mese (1/12 dell'importo annuo).
 */
export function quotaA(anno: number, dataNascita: IsoDate, p: ParametriAnno): DettaglioQuotaA {
  const annui: Cents[] = [];
  const mesi = Array.from({ length: 12 }, (_, i) => {
    const mese = i + 1;
    const fineMesePrecedente = mese === 1 ? ymd(anno - 1, 12, 31) : lastDayOfMonth(anno, mese - 1);
    const eta = etaAl(dataNascita, fineMesePrecedente);
    const annuo = importoAnnuoPerEta(eta, p);
    annui.push(annuo);
    return { mese, eta, importo: Math.round(annuo / 12) };
  });
  // Arrotondamento unico sul totale: se l'età non cambia nell'anno il totale è esattamente l'importo annuo.
  const contributoBase = Math.round(annui.reduce((a, v) => a + v, 0) / 12);
  const contributoMaternita = p.enpam.quotaA.contributoMaternita;
  return { totale: contributoBase + contributoMaternita, contributoBase, contributoMaternita, mesi };
}

export interface DettaglioQuotaB {
  totale: Cents;
  redditoProfessionale: Cents;
  soglia: Cents;
  baseAliquotaIntera: Cents;
  quotaAliquotaIntera: Cents;
  baseOltreMassimale: Cents;
  quotaOltreMassimale: Cents;
}

/**
 * Quota B dovuta sul reddito libero-professionale dell'anno (pagata nell'anno successivo).
 * - Forfettario: reddito = ricavi × coefficiente (rigo LM34, prima dei contributi).
 * - Ordinario: reddito = compensi − spese deducibili (quadro RE, senza togliere i contributi).
 * La parte già coperta dalla Quota A (soglia) è esente. Solo libero professionista puro (aliquota intera).
 *
 * `frazioneAnno` (0-1) serve per la Quota B MATURATA da inizio anno: soglia e massimale
 * si riducono in proporzione, come la Quota A maturata. Con 1 (default) è la Quota B dell'anno intero.
 */
export function quotaB(
  annoReddito: number,
  redditoProfessionale: Cents,
  dataNascita: IsoDate,
  p: ParametriAnno,
  frazioneAnno = 1,
): DettaglioQuotaB {
  const f = Math.min(1, Math.max(0, frazioneAnno));
  const eta = etaAl(dataNascita, ymd(annoReddito, 12, 31));
  const sogliaAnnua = eta < 40 ? p.enpam.quotaB.sogliaUnder40 : p.enpam.quotaB.sogliaOver40;
  const soglia = Math.round(sogliaAnnua * f);
  const massimale = Math.round(p.enpam.quotaB.massimale * f);
  const { aliquotaIntera, aliquotaOltreMassimale } = p.enpam.quotaB;
  const reddito = clampMin0(redditoProfessionale);

  if (reddito <= soglia) {
    return {
      totale: 0, redditoProfessionale: reddito, soglia,
      baseAliquotaIntera: 0, quotaAliquotaIntera: 0, baseOltreMassimale: 0, quotaOltreMassimale: 0,
    };
  }
  const baseAliquotaIntera = clampMin0(Math.min(reddito, massimale) - soglia);
  const baseOltreMassimale = clampMin0(reddito - massimale);
  const quotaAliquotaIntera = pct(baseAliquotaIntera, aliquotaIntera);
  const quotaOltreMassimale = pct(baseOltreMassimale, aliquotaOltreMassimale);
  return {
    totale: quotaAliquotaIntera + quotaOltreMassimale,
    redditoProfessionale: reddito,
    soglia,
    baseAliquotaIntera,
    quotaAliquotaIntera,
    baseOltreMassimale,
    quotaOltreMassimale,
  };
}
