import { clampMin0, pct, type Cents } from './money';
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
