import { clampMin0, formatEuro, pct, type Cents } from './money';
import type { ParametriAnno } from './params';
import type { Avviso, Profilo } from './types';

export interface InputForfettario {
  anno: number;
  /** Ricavi incassati nell'anno (principio di cassa). */
  ricavi: Cents;
  /** Contributi ENPAM versati nell'anno (Quota A + Quota B): deducibili. */
  contributiVersati: Cents;
  profilo: Pick<Profilo, 'annoInizioAttivita' | 'requisitiStartup5' | 'coefficienteRedditivita'>;
}

export interface RisultatoForfettario {
  ricavi: Cents;
  coefficiente: number;
  /** Reddito lordo = ricavi × coefficiente (rigo LM34): è anche la base della Quota B. */
  redditoLordo: Cents;
  contributiDedotti: Cents;
  /** Contributi non deducibili qui perché superano il reddito (deducibili da altri redditi). */
  contributiEccedenti: Cents;
  imponibile: Cents;
  aliquota: number;
  impostaSostitutiva: Cents;
  avvisi: Avviso[];
}

/** Aliquota dell'imposta sostitutiva: 5% per i primi 5 anni (se ci sono i requisiti), poi 15%. */
export function aliquotaForfettario(
  anno: number,
  profilo: InputForfettario['profilo'],
  p: ParametriAnno,
): number {
  const annoAttivita = anno - profilo.annoInizioAttivita + 1; // 1 = anno di apertura
  return profilo.requisitiStartup5 && annoAttivita >= 1 && annoAttivita <= p.forfettario.anniStartup
    ? p.forfettario.aliquotaStartup
    : p.forfettario.aliquotaOrdinaria;
}

/**
 * Avvisi (non blocchi) sui requisiti per restare nel forfettario, dai dati dell'anno precedente:
 * - redditi di lavoro dipendente oltre la soglia, salvo rapporto cessato entro il 31/12;
 * - ricavi dell'anno precedente oltre il limite (85.000 €).
 * `p` sono i parametri dell'anno in corso (la soglia 2026 riguarda i redditi 2025).
 */
export function avvisiRequisitiForfettario(
  profilo: Pick<Profilo, 'regime' | 'redditiLavoroDipendenteAnnoPrecedente' | 'rapportoCessatoEntro31_12' | 'annoPrecedente'>,
  p: ParametriAnno,
): Avviso[] {
  if (profilo.regime !== 'forfettario') return [];
  const avvisi: Avviso[] = [];
  const soglia = p.forfettario.sogliaRedditiDipendente.importo;
  if ((profilo.redditiLavoroDipendenteAnnoPrecedente ?? 0) > soglia && !profilo.rapportoCessatoEntro31_12) {
    avvisi.push({
      codice: 'FORF_REDDITI_DIPENDENTE',
      livello: 'attenzione',
      messaggio: `L'anno scorso hai avuto redditi da lavoro dipendente oltre ${formatEuro(soglia)}: potresti non avere i requisiti per il forfettario. Verifica con il commercialista.`,
    });
  }
  const prec = profilo.annoPrecedente;
  if (prec?.ricavi !== undefined && prec.ricavi > p.forfettario.limiteRicavi) {
    avvisi.push({
      codice: 'FORF_RICAVI_ANNO_PRECEDENTE',
      livello: 'critico',
      messaggio: `Nel ${prec.anno} hai superato ${formatEuro(p.forfettario.limiteRicavi)} di ricavi: quest'anno non puoi restare nel forfettario. Contatta il commercialista.`,
    });
  }
  return avvisi;
}

export function calcolaForfettario(input: InputForfettario, p: ParametriAnno): RisultatoForfettario {
  const coefficiente = input.profilo.coefficienteRedditivita ?? p.forfettario.coefficienteDefault;
  const redditoLordo = pct(input.ricavi, coefficiente);
  const contributiDedotti = Math.min(input.contributiVersati, redditoLordo);
  const contributiEccedenti = input.contributiVersati - contributiDedotti;
  const imponibile = clampMin0(redditoLordo - contributiDedotti);
  const aliquota = aliquotaForfettario(input.anno, input.profilo, p);
  const impostaSostitutiva = pct(imponibile, aliquota);

  const avvisi: Avviso[] = [];
  if (input.ricavi > p.forfettario.limiteUscitaImmediata) {
    avvisi.push({
      codice: 'FORF_USCITA_IMMEDIATA',
      livello: 'critico',
      messaggio:
        'Hai superato 100.000 € di ricavi: esci dal forfettario già da quest\'anno (IVA dalla fattura che supera il limite). Contatta subito il commercialista.',
    });
  } else if (input.ricavi > p.forfettario.limiteRicavi) {
    avvisi.push({
      codice: 'FORF_USCITA_ANNO_PROSSIMO',
      livello: 'critico',
      messaggio: 'Hai superato 85.000 € di ricavi: dal prossimo anno passi al regime ordinario.',
    });
  } else if (input.ricavi > pct(p.forfettario.limiteRicavi, 0.9)) {
    avvisi.push({
      codice: 'FORF_VICINO_LIMITE',
      livello: 'attenzione',
      messaggio: 'Sei oltre il 90% del limite di 85.000 € del forfettario.',
    });
  }
  if (contributiEccedenti > 0) {
    avvisi.push({
      codice: 'FORF_CONTRIBUTI_ECCEDENTI',
      livello: 'info',
      messaggio: 'I contributi versati superano il reddito forfettario: la parte eccedente si può dedurre da altri redditi.',
    });
  }

  return {
    ricavi: input.ricavi,
    coefficiente,
    redditoLordo,
    contributiDedotti,
    contributiEccedenti,
    imponibile,
    aliquota,
    impostaSostitutiva,
    avvisi,
  };
}
