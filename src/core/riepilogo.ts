import { confrontaAcconti, pianoAcconti, proiezioneAnnua, accontoAddizionaleComunale, type ConfrontoAcconti } from './acconti';
import type { TabelleAddizionali } from './addizionali';
import { addDays, isoYear } from './dates';
import { quotaA, quotaB, type DettaglioQuotaA, type DettaglioQuotaB } from './enpam';
import { calcolaForfettario, type RisultatoForfettario } from './forfettario';
import { liquidazioniIva, type RisultatoIva } from './iva';
import { clampMin0, sum, type Cents } from './money';
import {
  contributiEnpamVersati, creditiAperti, fattureIncassateAnno, nettoIncassato, ricaviAnno, ritenuteAnno, speseAnno,
  type Credito,
} from './movimenti';
import { calcolaOrdinario, type RisultatoOrdinario } from './ordinario';
import { getParametri, type ParametriAnno } from './params';
import { generaScadenziario, scadenzeImminenti, type Scadenza } from './scadenziario';
import type { Avviso, Fattura, IsoDate, Profilo, Spesa } from './types';

export interface InputRiepilogo {
  oggi: IsoDate;
  profilo: Profilo;
  fatture: Fattura[];
  spese: Spesa[];
  /** Giorni per le "scadenze imminenti" (default 30). */
  giorniImminenti?: number;
  tabelleAddizionali?: TabelleAddizionali;
}

export interface StimaImposte {
  regime: Profilo['regime'];
  ricavi: Cents;
  /** Base della Quota B (reddito libero-professionale). */
  redditoProfessionale: Cents;
  imposte: Cents;
  differenza: Cents;
  dettaglio: RisultatoForfettario | RisultatoOrdinario;
}

export interface Riepilogo {
  anno: number;
  oggi: IsoDate;
  /** true se i parametri dell'anno non esistono e sono stati usati quelli più vicini. */
  parametriApprossimati: boolean;
  /** Parametri non ancora verificati dal commercialista: mostrare "stima". */
  parametriDaVerificare: string[];

  incassatoLordo: Cents; // soldi entrati (IVA e bollo inclusi, ritenute escluse)
  ricavi: Cents; // fiscalmente rilevanti
  speseProfessionali: Cents; // escluse ENPAM e imposte
  contributiVersati: Cents;

  /** Stime sul periodo da inizio anno a oggi. */
  daInizioAnno: StimaImposte;
  /** Proiezione lineare a fine anno. */
  proiezione: StimaImposte & { affidabile: boolean };

  quotaA: DettaglioQuotaA;
  /** Quota B che maturerà sui redditi da inizio anno (si paga l'anno prossimo). */
  quotaBMaturata: DettaglioQuotaB;
  iva?: RisultatoIva;
  ivaDaVersare: Cents;

  /** Quanto mettere da parte per imposte e contributi relativi a quest'anno. */
  daAccantonare: Cents;
  /** Ricavi − spese − imposte − contributi − IVA: quanto hai guadagnato davvero finora. */
  guadagnoNetto: Cents;

  /** Percentuale del limite 85k€ (solo forfettario). */
  percentualeLimiteForfettario?: number;

  acconti?: ConfrontoAcconti;
  crediti: Credito[];
  totaleCrediti: Cents;
  scadenze: Scadenza[];
  scadenzeImminenti: Scadenza[];
  avvisi: Avviso[];
}

function stima(
  regime: Profilo['regime'], anno: number, ricavi: Cents, speseList: Spesa[], contributi: Cents, ritenute: Cents,
  profilo: Profilo, p: ParametriAnno, percDetrazioneIva: number, tabelle?: TabelleAddizionali,
): StimaImposte {
  if (regime === 'forfettario') {
    const r = calcolaForfettario({ anno, ricavi, contributiVersati: contributi, profilo }, p);
    return { regime, ricavi, redditoProfessionale: r.redditoLordo, imposte: r.impostaSostitutiva, differenza: r.impostaSostitutiva, dettaglio: r };
  }
  const r = calcolaOrdinario(
    { anno, compensi: ricavi, spese: speseList, contributiVersati: contributi, ritenuteSubite: ritenute, profilo, percentualeDetrazioneIva: percDetrazioneIva, tabelleAddizionali: tabelle },
    p,
  );
  return { regime, ricavi, redditoProfessionale: r.redditoProfessionale, imposte: r.totaleImposte, differenza: r.differenza, dettaglio: r };
}

const scala = (v: Cents, fattore: number): Cents => Math.round(v / fattore);

export function calcolaRiepilogo(input: InputRiepilogo): Riepilogo {
  const { oggi, profilo, fatture, spese } = input;
  const anno = isoYear(oggi);
  const { parametri: p, approssimati } = getParametri(anno);
  const avvisi: Avviso[] = [];

  const incassate = fattureIncassateAnno(fatture, anno).filter((f) => (f.dataIncasso as string) <= oggi);
  const incassatoLordo = sum(incassate.map((f) => nettoIncassato(f, p)));
  const ricavi = ricaviAnno(fatture, anno, p, oggi);
  const ritenute = ritenuteAnno(fatture.filter((f) => !f.dataIncasso || f.dataIncasso <= oggi), anno);
  const speseYtd = speseAnno(spese, anno, oggi);
  const speseProf = speseYtd.filter((s) => s.categoria !== 'contributi_enpam' && s.categoria !== 'imposte_f24');
  const speseProfessionali = sum(speseProf.map((s) => s.importo));
  const contributiVersati = contributiEnpamVersati(spese, anno, oggi);

  // IVA (solo ordinario)
  let iva: RisultatoIva | undefined;
  let ivaDaVersare: Cents = 0;
  let percDetrazioneIva = 0;
  if (profilo.regime === 'ordinario') {
    const fattureYtd = fatture.filter((f) => f.dataFattura <= oggi);
    iva = liquidazioniIva(fattureYtd, speseYtd, anno, p);
    percDetrazioneIva = iva.proRata;
    ivaDaVersare = clampMin0(iva.totaleDebito - iva.totaleCredito);
  }

  const daInizioAnno = stima(profilo.regime, anno, ricavi, speseProf, contributiVersati, ritenute, profilo, p, percDetrazioneIva, input.tabelleAddizionali);

  // Proiezione a fine anno
  const pr = proiezioneAnnua(ricavi, oggi);
  const f = pr.frazioneAnno;
  const speseProiettate = speseProf.map((s) => ({ ...s, importo: scala(s.importo, f), iva: s.iva === undefined ? undefined : scala(s.iva, f) }));
  const qa = quotaA(anno, profilo.dataNascita, p);
  const contributiProiettati = Math.max(contributiVersati, qa.totale);
  const proiezioneBase = stima(
    profilo.regime, anno, pr.valoreAnnuo, speseProiettate, contributiProiettati, scala(ritenute, f),
    profilo, p, percDetrazioneIva, input.tabelleAddizionali,
  );
  const proiezione = { ...proiezioneBase, affidabile: pr.affidabile };

  // Contributi ENPAM di competenza
  const quotaBMaturata = quotaB(anno, daInizioAnno.redditoProfessionale, profilo.dataNascita, p);
  const quotaANonVersata = clampMin0(Math.round(qa.totale * f) - contributiVersati);

  const daAccantonare = daInizioAnno.imposte + quotaBMaturata.totale + quotaANonVersata;
  const guadagnoNetto = ricavi - speseProfessionali - daInizioAnno.imposte - quotaBMaturata.totale - Math.round(qa.totale * f) - ivaDaVersare;

  // Acconti: storico vs previsionale
  let acconti: ConfrontoAcconti | undefined;
  const prec = profilo.annoPrecedente;
  if (prec) {
    acconti = confrontaAcconti(prec.impostaDifferenza, proiezione.differenza, p);
    avvisi.push(...acconti.avvisi);
  }

  // Scadenziario con importi stimati
  const piano = prec ? pianoAcconti(prec.impostaDifferenza, p) : undefined;
  const quotaBAnnoPrec = prec?.redditoProfessionale !== undefined
    ? quotaB(anno - 1, prec.redditoProfessionale, profilo.dataNascita, p).totale
    : undefined;
  const scadenze = generaScadenziario({
    anno,
    profilo,
    haOperazioniIva: !!iva && !iva.soloEsenti,
    importi: {
      quotaA: qa.totale,
      quotaB: quotaBAnnoPrec,
      saldoImposte: prec ? Math.max(0, prec.impostaDifferenza - (prec.accontiVersati ?? 0)) : undefined,
      primoAcconto: piano?.primaRata,
      secondoAcconto: piano?.secondaRata,
      accontoAddizionaleComunale: prec?.addizionaleComunale !== undefined && profilo.regime === 'ordinario'
        ? accontoAddizionaleComunale(prec.addizionaleComunale, p)
        : undefined,
      ivaTrimestri: iva ? { 1: iva.trimestri[0].daVersare, 2: iva.trimestri[1].daVersare, 3: iva.trimestri[2].daVersare } : undefined,
    },
  }, p);

  const crediti = creditiAperti(fatture, oggi, p);
  const vecchi = crediti.filter((c) => c.giorni > 60);
  if (vecchi.length > 0) {
    avvisi.push({ codice: 'CREDITI_SCADUTI', livello: 'attenzione', messaggio: `${vecchi.length} fatture non incassate da più di 60 giorni.` });
  }

  const daInviareSTS = fatture.filter((ft) => ft.destinatario === 'paziente' && ft.stato === 'incassata' && !ft.inviataSTS && ft.dataIncasso && isoYear(ft.dataIncasso) === anno - 1);
  if (daInviareSTS.length > 0) {
    avvisi.push({ codice: 'STS_DA_INVIARE', livello: 'critico', messaggio: `${daInviareSTS.length} fatture del ${anno - 1} non risultano inviate al Sistema TS.` });
  }

  avvisi.push(...(daInizioAnno.dettaglio as { avvisi: Avviso[] }).avvisi);
  if (profilo.regime === 'forfettario') {
    const sopra = (proiezione.dettaglio as RisultatoForfettario).avvisi.find((a) => a.codice.startsWith('FORF_USCITA'));
    if (sopra && !avvisi.some((a) => a.codice === sopra.codice)) {
      avvisi.push({ codice: 'FORF_PROIEZIONE_OLTRE_LIMITE', livello: 'attenzione', messaggio: 'Con questo ritmo di incassi supererai il limite di 85.000 € entro fine anno.' });
    }
  }
  if (approssimati) {
    avvisi.push({ codice: 'PARAMETRI_APPROSSIMATI', livello: 'attenzione', messaggio: `Parametri fiscali ${anno} non ancora aggiornati: le stime usano quelli dell'anno più vicino.` });
  }

  const gruppi = ['forfettario', 'irpef', 'detrazioneLavoroAutonomo', 'acconti', 'enpam', 'iva', 'bollo', 'spese', 'scadenze'] as const;
  const parametriDaVerificare = gruppi.filter((g) => !p[g].verificato);

  return {
    anno, oggi,
    parametriApprossimati: approssimati,
    parametriDaVerificare,
    incassatoLordo, ricavi, speseProfessionali, contributiVersati,
    daInizioAnno, proiezione,
    quotaA: qa, quotaBMaturata,
    iva, ivaDaVersare,
    daAccantonare, guadagnoNetto,
    percentualeLimiteForfettario: profilo.regime === 'forfettario' ? ricavi / p.forfettario.limiteRicavi : undefined,
    acconti,
    crediti,
    totaleCrediti: sum(crediti.map((c) => c.importo)),
    scadenze,
    scadenzeImminenti: scadenzeImminenti(scadenze, oggi, addDays(oggi, input.giorniImminenti ?? 30)),
    avvisi,
  };
}
