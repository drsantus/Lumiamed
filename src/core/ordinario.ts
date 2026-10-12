import { addizionaleComunale, addizionaleRegionale, type TabelleAddizionali } from './addizionali';
import { clampMin0, pct, sum, type Cents } from './money';
import type { ParametriAnno } from './params';
import { impostaProgressiva, type QuotaScaglione } from './scaglioni';
import type { Avviso, Profilo, Spesa } from './types';

export interface RisultatoSpese {
  totalePagato: Cents;
  deducibili: Cents;
  perCategoria: Partial<Record<Spesa['categoria'], { pagato: Cents; deducibile: Cents }>>;
  avvisi: Avviso[];
}

/**
 * Spese deducibili dal reddito professionale (regime ordinario, principio di cassa).
 * L'IVA detraibile non è un costo: viene esclusa dall'importo deducibile.
 * Esclusi: contributi ENPAM (oneri deducibili, gestiti a parte) e imposte.
 */
export function speseDeducibili(
  spese: Spesa[],
  compensi: Cents,
  p: ParametriAnno,
  percentualeDetrazioneIva = 0,
): RisultatoSpese {
  const perCategoria: RisultatoSpese['perCategoria'] = {};
  const avvisi: Avviso[] = [];

  for (const s of spese) {
    const ivaDetratta = pct(s.iva ?? 0, percentualeDetrazioneIva);
    const costo = s.importo - ivaDetratta;
    const quota = s.deducibilitaPersonalizzata ?? p.spese.deducibilita[s.categoria];
    const voce = (perCategoria[s.categoria] ??= { pagato: 0, deducibile: 0 });
    voce.pagato += s.importo;
    voce.deducibile += pct(costo, quota);
    if (s.categoria === 'attrezzature' && s.importo > 51_646) {
      avvisi.push({
        codice: 'SPESA_AMMORTAMENTO',
        livello: 'attenzione',
        messaggio: `"${s.descrizione ?? 'Attrezzatura'}" supera 516,46 €: di norma va ammortizzata in più anni. La stima la deduce tutta subito.`,
      });
    }
    if (s.categoria === 'auto') {
      avvisi.push({
        codice: 'SPESA_AUTO_LIMITI',
        livello: 'info',
        messaggio: 'Spese auto: dedotte al 20% senza applicare il limite di costo del veicolo. Verifica col commercialista.',
      });
    }
  }

  const rist = perCategoria.ristoranti_alberghi;
  if (rist) {
    const limite = pct(compensi, p.spese.limiteRistorantiSuCompensi);
    if (rist.deducibile > limite) rist.deducibile = limite;
  }
  const form = perCategoria.formazione_ecm;
  if (form && form.deducibile > p.spese.limiteFormazione) form.deducibile = p.spese.limiteFormazione;

  const voci = Object.values(perCategoria);
  return {
    totalePagato: sum(voci.map((v) => v!.pagato)),
    deducibili: sum(voci.map((v) => v!.deducibile)),
    perCategoria,
    avvisi: dedup(avvisi),
  };
}

const dedup = (avvisi: Avviso[]): Avviso[] =>
  avvisi.filter((a, i) => a.codice === 'SPESA_AMMORTAMENTO' || avvisi.findIndex((b) => b.codice === a.codice) === i);

/** Detrazione per redditi di lavoro autonomo (art. 13 c. 5 TUIR). */
export function detrazioneLavoroAutonomo(redditoComplessivo: Cents, p: ParametriAnno): Cents {
  const d = p.detrazioneLavoroAutonomo;
  const r = redditoComplessivo;
  if (r <= 0) return 0;
  if (r <= d.soglia1) return d.importo1;
  if (r <= d.soglia2) return Math.round(d.base2 + (d.variabile2 * (d.soglia2 - r)) / (d.soglia2 - d.soglia1));
  if (r <= d.soglia3) return Math.round((d.base3 * (d.soglia3 - r)) / (d.soglia3 - d.soglia2));
  return 0;
}

export interface InputOrdinario {
  anno: number;
  compensi: Cents;
  spese: Spesa[];
  /** Contributi ENPAM versati nell'anno: oneri deducibili. */
  contributiVersati: Cents;
  ritenuteSubite: Cents;
  profilo: Pick<Profilo, 'regione' | 'comuneCodiceCatastale'>;
  /** Percentuale di detrazione IVA (pro-rata), 0-1. */
  percentualeDetrazioneIva?: number;
  tabelleAddizionali?: TabelleAddizionali;
}

export interface RisultatoOrdinario {
  compensi: Cents;
  speseDeducibili: Cents;
  /** Reddito di lavoro autonomo (quadro RE): base anche per la Quota B. */
  redditoProfessionale: Cents;
  redditoComplessivo: Cents;
  oneriDeducibili: Cents;
  imponibile: Cents;
  impostaLorda: Cents;
  dettaglioScaglioni: QuotaScaglione[];
  detrazioneLavoroAutonomo: Cents;
  impostaNetta: Cents;
  ritenute: Cents;
  /** Imposta netta meno ritenute ("rigo differenza"): base degli acconti. Può essere negativa (credito). */
  differenza: Cents;
  addizionaleRegionale: Cents;
  addizionaleComunale: Cents;
  totaleImposte: Cents;
  avvisi: Avviso[];
}

export function calcolaOrdinario(input: InputOrdinario, p: ParametriAnno): RisultatoOrdinario {
  const spese = speseDeducibili(
    input.spese.filter((s) => s.categoria !== 'contributi_enpam'),
    input.compensi,
    p,
    input.percentualeDetrazioneIva ?? 0,
  );
  const redditoProfessionale = input.compensi - spese.deducibili;
  const redditoComplessivo = clampMin0(redditoProfessionale);
  const oneriDeducibili = Math.min(input.contributiVersati, redditoComplessivo);
  const imponibile = clampMin0(redditoComplessivo - oneriDeducibili);

  const { totale: impostaLorda, dettaglio } = impostaProgressiva(imponibile, p.irpef.scaglioni);
  const detrazione = Math.min(detrazioneLavoroAutonomo(redditoComplessivo, p), impostaLorda);
  const impostaNetta = impostaLorda - detrazione;

  // Le addizionali non sono dovute se l'IRPEF netta è zero.
  const regionale = impostaNetta > 0
    ? addizionaleRegionale(imponibile, input.profilo.regione, input.tabelleAddizionali)
    : { importo: 0, avvisi: [] };
  const comunale = impostaNetta > 0
    ? addizionaleComunale(imponibile, input.profilo.comuneCodiceCatastale, input.tabelleAddizionali, input.anno)
    : { importo: 0, avvisi: [] };

  const avvisi: Avviso[] = [...spese.avvisi, ...regionale.avvisi, ...comunale.avvisi];
  if (redditoProfessionale < 0) {
    avvisi.push({
      codice: 'ORD_PERDITA',
      livello: 'info',
      messaggio: 'Le spese superano i compensi: risulta una perdita professionale.',
    });
  }

  return {
    compensi: input.compensi,
    speseDeducibili: spese.deducibili,
    redditoProfessionale,
    redditoComplessivo,
    oneriDeducibili,
    imponibile,
    impostaLorda,
    dettaglioScaglioni: dettaglio,
    detrazioneLavoroAutonomo: detrazione,
    impostaNetta,
    ritenute: input.ritenuteSubite,
    differenza: impostaNetta - input.ritenuteSubite,
    addizionaleRegionale: regionale.importo,
    addizionaleComunale: comunale.importo,
    totaleImposte: impostaNetta + regionale.importo + comunale.importo,
    avvisi,
  };
}
