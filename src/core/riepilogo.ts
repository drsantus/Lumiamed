import { confrontaAcconti, pianoAcconti, proiezioneAnnua, accontoAddizionaleComunale, type ConfrontoAcconti } from './acconti';
import type { TabelleAddizionali } from './addizionali';
import { addDays, isoYear } from './dates';
import { quotaA, quotaB, type DettaglioQuotaA, type DettaglioQuotaB } from './enpam';
import { aliquotaForfettario, avvisiRequisitiForfettario, calcolaForfettario, type RisultatoForfettario } from './forfettario';
import { liquidazioniIva, type RisultatoIva } from './iva';
import { clampMin0, pct, sum, type Cents } from './money';
import {
  contributiEnpamVersati, creditiAperti, fattureIncassateAnno, nettoIncassato, ricaviAnno, ritenuteAnno, speseAnno,
  type Credito,
} from './movimenti';
import { calcolaOrdinario, type RisultatoOrdinario } from './ordinario';
import { getParametri, parametriDaVerificare, type ParametriAnno } from './params';
import { frazioneQuotaBNellAnno, scadenzeImminenti, scadenzeProssimi12Mesi, type Scadenza } from './scadenziario';
import type { Avviso, DatiAnnoPrecedente, Fattura, IsoDate, Profilo, Spesa } from './types';
import { attribuisciVersamenti, totaleVersato } from './versamenti';

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

/**
 * Come si stima l'imposta maturata da inizio anno:
 * - 'proiezione': imposta dell'anno intero stimata con la proiezione × frazione d'anno trascorsa
 *   (corretta anche con gli scaglioni IRPEF);
 * - 'anno_precedente': nei primi 60 giorni, se ci sono i dati dell'anno scorso,
 *   ricavi da inizio anno × aliquota effettiva dell'anno scorso.
 */
export type MetodoStima = 'proiezione' | 'anno_precedente';

/** Composizione del "da accantonare" per l'anno in corso. Nessuna voce è negativa. */
export interface DettaglioAccantonamento {
  metodo: MetodoStima;
  /** Imposte (IRPEF e addizionali, o imposta sostitutiva) maturate da inizio anno. */
  imposteMaturate: Cents;
  /** Ritenute d'acconto già trattenute dai clienti quest'anno. */
  ritenute: Cents;
  /** Acconti già versati con F24 per quest'anno. */
  accontiVersati: Cents;
  /** Imposte ancora da accantonare: maturate − ritenute − acconti (minimo 0). */
  imposte: Cents;
  /** Quota A di quest'anno non ancora versata. */
  quotaAResidua: Cents;
  /** Quota B maturata sui redditi da inizio anno (si paga l'anno prossimo). */
  quotaBMaturata: Cents;
  /** IVA incassata e non ancora versata (solo ordinario). */
  iva: Cents;
  totale: Cents;
}

/** Debiti dell'anno scorso non ancora pagati: vanno tenuti da parte oltre al "da accantonare". */
export interface ImpegniAnnoPrecedente {
  anno: number;
  saldoImposte: Cents;
  /** Solo ordinario: addizionale regionale + saldo dell'addizionale comunale. */
  saldoAddizionali: Cents;
  /** Quota B sui redditi dell'anno scorso non ancora versata. */
  quotaB: Cents;
  totale: Cents;
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

  /**
   * Calcolo sui SOLI dati da inizio anno (come se l'anno finisse oggi).
   * Non usarlo per "quanto accantonare": con gli scaglioni sottostima. Usa `accantonamento`.
   */
  daInizioAnno: StimaImposte;
  /** Proiezione lineare a fine anno. */
  proiezione: StimaImposte & { affidabile: boolean };

  quotaA: DettaglioQuotaA;
  /** Quota B maturata sui redditi da inizio anno, con soglia proporzionale alla frazione d'anno. */
  quotaBMaturata: DettaglioQuotaB;
  iva?: RisultatoIva;
  /** IVA incassata e non ancora versata (dovuta − già versata). */
  ivaDaVersare: Cents;

  /** Quanto mettere da parte per imposte e contributi di quest'anno, al netto di quanto già pagato. */
  daAccantonare: Cents;
  accantonamento: DettaglioAccantonamento;
  /** Debiti dell'anno scorso ancora da pagare (presente se ci sono i dati dell'anno precedente). */
  impegniAnnoPrecedente?: ImpegniAnnoPrecedente;
  /** Da accantonare + impegni dell'anno scorso: liquidità che non è davvero tua. */
  liquiditaImpegnata: Cents;
  /** Ricavi − spese (al netto dell'IVA detraibile) − imposte e contributi maturati: quanto hai guadagnato davvero finora. */
  guadagnoNetto: Cents;

  /** Percentuale del limite 85k€ (solo forfettario). */
  percentualeLimiteForfettario?: number;

  acconti?: ConfrontoAcconti;
  crediti: Credito[];
  totaleCrediti: Cents;
  /** Scadenze dei prossimi 12 mesi (da oggi), con importi stimati. */
  scadenze: Scadenza[];
  scadenzeImminenti: Scadenza[];
  avvisi: Avviso[];
}

function stima(
  regime: Profilo['regime'], anno: number, ricavi: Cents, speseList: Spesa[], contributi: Cents, ritenute: Cents,
  profilo: Profilo, p: ParametriAnno, percDetrazioneIva: number, altriRedditi: Cents, tabelle?: TabelleAddizionali,
): StimaImposte {
  if (regime === 'forfettario') {
    const r = calcolaForfettario({ anno, ricavi, contributiVersati: contributi, profilo }, p);
    return { regime, ricavi, redditoProfessionale: r.redditoLordo, imposte: r.impostaSostitutiva, differenza: r.impostaSostitutiva, dettaglio: r };
  }
  const r = calcolaOrdinario(
    { anno, compensi: ricavi, spese: speseList, contributiVersati: contributi, ritenuteSubite: ritenute, profilo, percentualeDetrazioneIva: percDetrazioneIva, tabelleAddizionali: tabelle, altriRedditi },
    p,
  );
  return { regime, ricavi, redditoProfessionale: r.redditoProfessionale, imposte: r.totaleImposte, differenza: r.differenza, dettaglio: r };
}

const scala = (v: Cents, fattore: number): Cents => Math.round(v / fattore);

/** Saldo delle addizionali dell'anno precedente (ordinario): regionale intera + comunale meno l'acconto già versato. */
export function saldoAddizionaliAnnoPrecedente(prec: DatiAnnoPrecedente, p: ParametriAnno): Cents {
  const comunale = prec.addizionaleComunale ?? 0;
  const accontoComunale = prec.accontoAddizionaleComunaleVersato ?? pct(comunale, p.acconti.accontoAddizionaleComunale);
  return (prec.addizionaleRegionale ?? 0) + clampMin0(comunale - accontoComunale);
}

/**
 * Aliquota effettiva dell'anno precedente: imposte totali ÷ ricavi.
 * Forfettario: se quest'anno cambia l'aliquota (5% → 15%) si riproporziona.
 * undefined se mancano i ricavi dell'anno scorso.
 */
export function aliquotaEffettivaAnnoPrecedente(profilo: Profilo, anno: number, p: ParametriAnno): number | undefined {
  const prec = profilo.annoPrecedente;
  if (!prec?.ricavi || prec.ricavi <= 0) return undefined;
  if (profilo.regime === 'forfettario') {
    const pPrec = getParametri(prec.anno).parametri;
    const rapporto = aliquotaForfettario(anno, profilo, p) / aliquotaForfettario(prec.anno, profilo, pPrec);
    return Math.max(0, prec.impostaDifferenza / prec.ricavi) * rapporto;
  }
  const imposte = prec.impostaDifferenza + (prec.ritenute ?? 0) + (prec.addizionaleRegionale ?? 0) + (prec.addizionaleComunale ?? 0);
  return Math.max(0, imposte / prec.ricavi);
}

export function calcolaRiepilogo(input: InputRiepilogo): Riepilogo {
  const { oggi, profilo, fatture, spese } = input;
  const anno = isoYear(oggi);
  const { parametri: p, approssimati } = getParametri(anno);
  const avvisi: Avviso[] = [];
  const prec = profilo.annoPrecedente;
  const ordinario = profilo.regime === 'ordinario';

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
  let percDetrazioneIva = 0;
  if (ordinario) {
    const fattureYtd = fatture.filter((f) => f.dataFattura <= oggi);
    iva = liquidazioniIva(fattureYtd, speseYtd, anno, p);
    percDetrazioneIva = iva.proRata;
  }

  // Importi noti dell'anno: Quota A, debiti dell'anno scorso
  const qa = quotaA(anno, profilo.dataNascita, p);
  // Quota B sui redditi dell'anno scorso: parametri dell'anno del reddito.
  const quotaBAnnoPrec = prec?.redditoProfessionale !== undefined
    ? quotaB(anno - 1, prec.redditoProfessionale, profilo.dataNascita, getParametri(anno - 1).parametri, 1, profilo.aliquotaQuotaB).totale
    : undefined;
  const saldoImposteDovuto = prec ? clampMin0(prec.impostaDifferenza - (prec.accontiVersati ?? 0)) : 0;
  const saldoAddizionaliDovuto = prec && ordinario ? saldoAddizionaliAnnoPrecedente(prec, p) : 0;

  // Versamenti già fatti (F24 ed ENPAM), con il loro riferimento
  const att = attribuisciVersamenti(spese, {
    anno, oggi, quotaAAnnua: qa.totale,
    saldoImposteAnnoPrecedente: saldoImposteDovuto,
    saldoAddizionaliAnnoPrecedente: saldoAddizionaliDovuto,
    quotaBAnnoPrecedente: quotaBAnnoPrec,
    rateQuotaA: profilo.rateQuotaA,
    rateQuotaB: profilo.rateQuotaB,
    ivaTrimestri: iva && !iva.soloEsenti
      ? { 1: iva.trimestri[0].daVersare, 2: iva.trimestri[1].daVersare, 3: iva.trimestri[2].daVersare }
      : undefined,
  });
  avvisi.push(...att.avvisi);
  const quotaAVersata = totaleVersato(att.versamenti, ['enpam_quota_a'], anno);
  const quotaBPrecVersata = totaleVersato(att.versamenti, ['enpam_quota_b'], anno - 1);
  const accontiVersati = totaleVersato(att.versamenti, ['imposta', 'addizionale_regionale', 'addizionale_comunale'], anno, 'acconto');
  const saldoImpostePagato = totaleVersato(att.versamenti, ['imposta'], anno - 1, 'saldo');
  const saldoAddizionaliPagato = totaleVersato(att.versamenti, ['addizionale_regionale', 'addizionale_comunale'], anno - 1, 'saldo');
  const ivaVersata = totaleVersato(att.versamenti, ['iva'], anno);

  // Altri redditi (solo ordinario): il valore del profilo è annuo; da inizio anno se ne conta la quota maturata.
  const pr = proiezioneAnnua(ricavi, oggi);
  const f = pr.frazioneAnno;
  const altriRedditiAnnui = ordinario ? profilo.redditoLavoroDipendente ?? 0 : 0;

  const daInizioAnno = stima(
    profilo.regime, anno, ricavi, speseProf, contributiVersati, ritenute, profilo, p, percDetrazioneIva,
    Math.round(altriRedditiAnnui * f), input.tabelleAddizionali,
  );

  // Proiezione a fine anno. Contributi deducibili dell'anno: già versati + Quota A residua
  // + Quota B dell'anno scorso che scade entro dicembre (secondo il piano di rate).
  const speseProiettate = speseProf.map((s) => ({ ...s, importo: scala(s.importo, f), iva: s.iva === undefined ? undefined : scala(s.iva, f) }));
  const quotaAResidua = clampMin0(qa.totale - quotaAVersata);
  const quotaBPrecNellAnno = quotaBAnnoPrec !== undefined ? Math.round(quotaBAnnoPrec * frazioneQuotaBNellAnno(profilo.rateQuotaB)) : 0;
  const contributiProiettati = contributiVersati + quotaAResidua + clampMin0(quotaBPrecNellAnno - quotaBPrecVersata);
  const proiezioneBase = stima(
    profilo.regime, anno, pr.valoreAnnuo, speseProiettate, contributiProiettati, scala(ritenute, f),
    profilo, p, percDetrazioneIva, altriRedditiAnnui, input.tabelleAddizionali,
  );
  const proiezione = { ...proiezioneBase, affidabile: pr.affidabile };

  // Imposte maturate da inizio anno (opzione 2: aliquota dell'anno scorso nei primi 60 giorni)
  const aliquotaPrec = aliquotaEffettivaAnnoPrecedente(profilo, anno, p);
  const metodo: MetodoStima = !pr.affidabile && aliquotaPrec !== undefined ? 'anno_precedente' : 'proiezione';
  const imposteMaturate = metodo === 'anno_precedente'
    ? pct(ricavi, aliquotaPrec as number)
    : Math.round(proiezione.imposte * f);
  if (metodo === 'anno_precedente') {
    avvisi.push({ codice: 'STIMA_ANNO_PRECEDENTE', livello: 'info', messaggio: 'Inizio anno: le imposte maturate sono stimate con l\'aliquota effettiva dell\'anno scorso.' });
  } else if (!pr.affidabile) {
    avvisi.push({ codice: 'STIMA_POCO_AFFIDABILE', livello: 'attenzione', messaggio: 'Pochi dati da inizio anno: la stima è poco affidabile. Inserisci i dati dell\'anno scorso per una stima più stabile.' });
  }

  // Contributi ENPAM di competenza
  const quotaBMaturata = quotaB(anno, daInizioAnno.redditoProfessionale, profilo.dataNascita, p, f, profilo.aliquotaQuotaB);
  const quotaAMaturata = Math.round(qa.totale * f);

  // IVA incassata e non ancora versata
  const ivaDovuta = iva ? sum(iva.trimestri.map((t) => t.daVersare)) : 0;
  const ivaDaVersare = clampMin0(ivaDovuta - ivaVersata);

  const imposteDaAccantonare = clampMin0(imposteMaturate - ritenute - accontiVersati);
  const daAccantonare = imposteDaAccantonare + quotaAResidua + quotaBMaturata.totale + ivaDaVersare;
  const accantonamento: DettaglioAccantonamento = {
    metodo, imposteMaturate, ritenute, accontiVersati, imposte: imposteDaAccantonare,
    quotaAResidua, quotaBMaturata: quotaBMaturata.totale, iva: ivaDaVersare, totale: daAccantonare,
  };

  let impegniAnnoPrecedente: ImpegniAnnoPrecedente | undefined;
  if (prec) {
    const saldoImposte = clampMin0(saldoImposteDovuto - saldoImpostePagato);
    const saldoAddizionali = clampMin0(saldoAddizionaliDovuto - saldoAddizionaliPagato);
    const quotaBResidua = clampMin0((quotaBAnnoPrec ?? 0) - quotaBPrecVersata);
    impegniAnnoPrecedente = {
      anno: anno - 1, saldoImposte, saldoAddizionali, quotaB: quotaBResidua,
      totale: saldoImposte + saldoAddizionali + quotaBResidua,
    };
  }

  // Netto reale: i ricavi non contengono IVA, quindi l'IVA non si sottrae; l'IVA detraibile sugli acquisti non è un costo.
  const ivaDetraibile = iva?.totaleCredito ?? 0;
  const guadagnoNetto = ricavi - (speseProfessionali - ivaDetraibile) - imposteMaturate - quotaBMaturata.totale - quotaAMaturata;

  // Acconti: storico vs previsionale
  let acconti: ConfrontoAcconti | undefined;
  if (prec) {
    acconti = confrontaAcconti(prec.impostaDifferenza, proiezione.differenza, p);
    avvisi.push(...acconti.avvisi);
  }

  // Scadenziario dei prossimi 12 mesi con importi stimati
  const piano = prec ? pianoAcconti(prec.impostaDifferenza, p) : undefined;
  const scadenze = scadenzeProssimi12Mesi({
    oggi,
    profilo,
    haOperazioniIva: !!iva && !iva.soloEsenti,
    importi: {
      quotaA: qa.totale,
      quotaB: quotaBAnnoPrec,
      saldoImposte: prec ? saldoImposteDovuto : undefined,
      saldoAddizionali: prec && ordinario ? saldoAddizionaliDovuto : undefined,
      primoAcconto: piano?.primaRata,
      secondoAcconto: piano?.secondaRata,
      accontoAddizionaleComunale: prec?.addizionaleComunale !== undefined && ordinario
        ? accontoAddizionaleComunale(prec.addizionaleComunale, p)
        : undefined,
      ivaTrimestri: iva ? { 1: iva.trimestri[0].daVersare, 2: iva.trimestri[1].daVersare, 3: iva.trimestri[2].daVersare } : undefined,
    },
  });

  const crediti = creditiAperti(fatture, oggi, p);
  const vecchi = crediti.filter((c) => c.giorni > 60);
  if (vecchi.length > 0) {
    avvisi.push({ codice: 'CREDITI_SCADUTI', livello: 'attenzione', messaggio: `${vecchi.length} fatture non incassate da più di 60 giorni.` });
  }

  // Le fatture caricate come storico sono totali, non singole spese da trasmettere.
  const daInviareSTS = fatture.filter((ft) => ft.destinatario === 'paziente' && ft.stato === 'incassata' && !ft.inviataSTS && !ft.storico && ft.dataIncasso && isoYear(ft.dataIncasso) === anno - 1);
  if (daInviareSTS.length > 0) {
    avvisi.push({ codice: 'STS_DA_INVIARE', livello: 'critico', messaggio: `${daInviareSTS.length} fatture del ${anno - 1} non risultano inviate al Sistema TS.` });
  }

  avvisi.push(...(daInizioAnno.dettaglio as { avvisi: Avviso[] }).avvisi);
  avvisi.push(...avvisiRequisitiForfettario(profilo, p));
  if (profilo.regime === 'forfettario') {
    const sopra = (proiezione.dettaglio as RisultatoForfettario).avvisi.find((a) => a.codice.startsWith('FORF_USCITA'));
    if (sopra && !avvisi.some((a) => a.codice === sopra.codice)) {
      avvisi.push({ codice: 'FORF_PROIEZIONE_OLTRE_LIMITE', livello: 'attenzione', messaggio: 'Con questo ritmo di incassi supererai il limite di 85.000 € entro fine anno.' });
    }
  }
  if (approssimati) {
    avvisi.push({ codice: 'PARAMETRI_APPROSSIMATI', livello: 'attenzione', messaggio: `Parametri fiscali ${anno} non ancora aggiornati: le stime usano quelli dell'anno più vicino.` });
  }


  return {
    anno, oggi,
    parametriApprossimati: approssimati,
    parametriDaVerificare: parametriDaVerificare(p),
    incassatoLordo, ricavi, speseProfessionali, contributiVersati,
    daInizioAnno, proiezione,
    quotaA: qa, quotaBMaturata,
    iva, ivaDaVersare,
    daAccantonare, accantonamento, impegniAnnoPrecedente,
    liquiditaImpegnata: daAccantonare + (impegniAnnoPrecedente?.totale ?? 0),
    guadagnoNetto,
    percentualeLimiteForfettario: profilo.regime === 'forfettario' ? ricavi / p.forfettario.limiteRicavi : undefined,
    acconti,
    crediti,
    totaleCrediti: sum(crediti.map((c) => c.importo)),
    scadenze,
    scadenzeImminenti: scadenzeImminenti(scadenze, oggi, addDays(oggi, input.giorniImminenti ?? 30)),
    avvisi,
  };
}
