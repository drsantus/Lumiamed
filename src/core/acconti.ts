import { daysBetween, ymd } from './dates';
import { pct, type Cents } from './money';
import type { ParametriAnno } from './params';
import type { Avviso, IsoDate } from './types';

export interface PianoAcconti {
  base: Cents;
  totale: Cents;
  /** Prima rata (con il saldo, a giugno/luglio). 0 se si paga in unica soluzione a novembre. */
  primaRata: Cents;
  /** Seconda rata o unica soluzione (30 novembre). */
  secondaRata: Cents;
  modalita: 'nessuno' | 'unica_soluzione' | 'due_rate';
}

/**
 * Acconti dell'imposta (IRPEF o imposta sostitutiva) per soggetti ISA e forfettari.
 * base = "rigo differenza" dell'anno precedente (metodo storico) oppure imposta stimata (previsionale).
 */
export function pianoAcconti(base: Cents, p: ParametriAnno): PianoAcconti {
  const { sogliaNessunAcconto, sogliaUnicaSoluzione, percentuale, primaRataIsa } = p.acconti;
  // Acconto non dovuto se la differenza non supera 51,65 € (51,65 compreso).
  if (base <= sogliaNessunAcconto) {
    return { base, totale: 0, primaRata: 0, secondaRata: 0, modalita: 'nessuno' };
  }
  const totale = pct(base, percentuale);
  if (base < sogliaUnicaSoluzione) {
    return { base, totale, primaRata: 0, secondaRata: totale, modalita: 'unica_soluzione' };
  }
  const primaRata = pct(totale, primaRataIsa);
  return { base, totale, primaRata, secondaRata: totale - primaRata, modalita: 'due_rate' };
}

/** Acconto dell'addizionale comunale: 30% dell'addizionale dell'anno precedente, versato con il saldo. */
export const accontoAddizionaleComunale = (addizionaleAnnoPrecedente: Cents, p: ParametriAnno): Cents =>
  pct(addizionaleAnnoPrecedente, p.acconti.accontoAddizionaleComunale);

export interface Proiezione {
  valoreAnnuo: Cents;
  frazioneAnno: number;
  /** Con meno di 60 giorni di dati la proiezione è poco affidabile. */
  affidabile: boolean;
}

/** Proietta un valore da inizio anno a fine anno in modo lineare. */
export function proiezioneAnnua(valoreDaInizioAnno: Cents, oggi: IsoDate): Proiezione {
  const anno = Number(oggi.slice(0, 4));
  const giorniAnno = daysBetween(ymd(anno, 1, 1), ymd(anno + 1, 1, 1));
  const trascorsi = daysBetween(ymd(anno, 1, 1), oggi) + 1;
  const frazioneAnno = Math.min(1, trascorsi / giorniAnno);
  return {
    valoreAnnuo: Math.round(valoreDaInizioAnno / frazioneAnno),
    frazioneAnno,
    affidabile: trascorsi >= 60,
  };
}

export interface ConfrontoAcconti {
  storico: PianoAcconti;
  previsionale: PianoAcconti;
  /** Quanto si verserebbe in meno con il metodo previsionale (0 se non conviene). */
  risparmioPrevisionale: Cents;
  avvisi: Avviso[];
}

/**
 * Confronto tra metodo storico (imposta dell'anno precedente) e previsionale
 * (imposta stimata per l'anno in corso). Il previsionale conviene se si guadagna meno,
 * ma se la stima è troppo bassa si pagano sanzioni e interessi.
 */
export function confrontaAcconti(
  baseStorica: Cents,
  impostaStimataAnnoCorrente: Cents,
  p: ParametriAnno,
): ConfrontoAcconti {
  const storico = pianoAcconti(baseStorica, p);
  const previsionale = pianoAcconti(impostaStimataAnnoCorrente, p);
  const risparmio = Math.max(0, storico.totale - previsionale.totale);
  const avvisi: Avviso[] = [];
  if (risparmio > 0) {
    avvisi.push({
      codice: 'ACCONTI_PREVISIONALE_CONVIENE',
      livello: 'info',
      messaggio:
        'Quest\'anno stai incassando meno: con il metodo previsionale potresti versare acconti più bassi. Se la stima è sbagliata ci sono sanzioni: decidi con il commercialista.',
    });
  }
  if (impostaStimataAnnoCorrente > baseStorica * 1.2 && impostaStimataAnnoCorrente - baseStorica > 50_000) {
    avvisi.push({
      codice: 'ACCONTI_SALDO_ALTO',
      livello: 'attenzione',
      messaggio:
        'Stai guadagnando molto più dell\'anno scorso: gli acconti storici saranno bassi e il saldo del prossimo anno alto. Accantona la differenza.',
    });
  }
  return { storico, previsionale, risparmioPrevisionale: risparmio, avvisi };
}
