import { isoMonth, isoYear } from './dates';
import { sum, type Cents } from './money';
import { quotaADovutaEntro, rataQuotaBNelMese } from './scadenziario';
import type { Avviso, IsoDate, Profilo, RiferimentoVersamento, Spesa, TributoVersamento } from './types';

/**
 * Versamenti di imposte (F24) e contributi ENPAM: a quale tributo e a quale anno si riferiscono.
 * Serve per sapere cosa è già stato pagato (acconti, Quota A, saldo dell'anno scorso)
 * e quindi quanto resta davvero da accantonare.
 */

export interface VersamentoAttribuito {
  spesaId: string;
  data: IsoDate;
  /** Può essere una parte del versamento, se è stato diviso tra più tributi. */
  importo: Cents;
  riferimento: RiferimentoVersamento;
  /** true se il riferimento è stato dedotto dalla data (l'utente non l'ha indicato). */
  dedotto: boolean;
}

export interface OpzioniAttribuzione {
  /** Anno in corso. */
  anno: number;
  oggi: IsoDate;
  /** Quota A dovuta quest'anno (con maternità). */
  quotaAAnnua: Cents;
  /** Saldo delle imposte dell'anno precedente ancora dovuto a inizio anno. */
  saldoImposteAnnoPrecedente?: Cents;
  /** Saldo delle addizionali dell'anno precedente ancora dovuto a inizio anno (solo ordinario). */
  saldoAddizionaliAnnoPrecedente?: Cents;
  /** Quota B sui redditi dell'anno scorso (si paga da ottobre). Se indicata, l'eccedenza non viene attribuita. */
  quotaBAnnoPrecedente?: Cents;
  /** Piani di rate ENPAM: nei mesi con una rata di Quota B, alla Quota A va solo la rata scaduta. */
  rateQuotaA?: Profilo['rateQuotaA'];
  rateQuotaB?: Profilo['rateQuotaB'];
  /** Ordinario con operazioni IVA: IVA dovuta per trimestre (si versa a maggio, agosto, novembre). */
  ivaTrimestri?: Partial<Record<1 | 2 | 3, Cents>>;
}

/** Mese di versamento → trimestre IVA liquidato. */
const TRIMESTRE_IVA: Partial<Record<number, 1 | 2 | 3>> = { 5: 1, 8: 2, 11: 3 };

export interface RisultatoAttribuzione {
  versamenti: VersamentoAttribuito[];
  avvisi: Avviso[];
}

const VERSAMENTI = new Set<Spesa['categoria']>(['imposte_f24', 'contributi_enpam']);

/**
 * Attribuisce i versamenti dell'anno in corso (fino a oggi).
 * Senza riferimento indicato dall'utente si usa il calendario delle scadenze:
 * - ENPAM gennaio-marzo: rate della Quota B sui redditi di due anni fa;
 * - ENPAM da aprile: prima la Quota A dell'anno (fino al suo importo; nei mesi con una rata di Quota B
 *   solo fino alla rata di Quota A scaduta), poi Quota B: redditi di due anni fa fino a giugno,
 *   dell'anno scorso da ottobre (fino al suo importo). A luglio-settembre e oltre il dovuto: eccedenza, non attribuita (avviso);
 * - F24 di maggio, agosto e novembre (ordinario con IVA): prima l'IVA del trimestre;
 * - F24 giugno-agosto: poi il saldo dell'anno scorso (imposte, poi addizionali), il resto è primo acconto;
 * - F24 novembre-dicembre: secondo acconto dell'anno;
 * - F24 negli altri mesi senza riferimento: non attribuiti (avviso).
 */
export function attribuisciVersamenti(spese: Spesa[], opt: OpzioniAttribuzione): RisultatoAttribuzione {
  const { anno, oggi } = opt;
  const delAnno = spese
    .filter((s) => VERSAMENTI.has(s.categoria) && isoYear(s.data) === anno && s.data <= oggi)
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));

  const versamenti: VersamentoAttribuito[] = [];
  const nonAttribuiti: Spesa[] = [];

  // Prima i versamenti con riferimento esplicito: riducono i residui usati per dedurre gli altri.
  for (const s of delAnno) {
    if (s.riferimento) versamenti.push({ spesaId: s.id, data: s.data, importo: s.importo, riferimento: s.riferimento, dedotto: false });
  }
  const pagato = (tributi: TributoVersamento[], annoRif: number, tipo?: 'saldo' | 'acconto') =>
    sum(versamenti
      .filter((v) => tributi.includes(v.riferimento.tributo) && v.riferimento.anno === annoRif && (!tipo || v.riferimento.tipo === tipo))
      .map((v) => v.importo));

  let residuoQuotaA = Math.max(0, opt.quotaAAnnua - pagato(['enpam_quota_a'], anno));
  let residuoSaldoImposte = Math.max(0, (opt.saldoImposteAnnoPrecedente ?? 0) - pagato(['imposta'], anno - 1, 'saldo'));
  let residuoSaldoAdd = Math.max(0, (opt.saldoAddizionaliAnnoPrecedente ?? 0)
    - pagato(['addizionale_regionale', 'addizionale_comunale'], anno - 1, 'saldo'));
  let residuoQuotaBPrec = opt.quotaBAnnoPrecedente === undefined
    ? Infinity
    : Math.max(0, opt.quotaBAnnoPrecedente - pagato(['enpam_quota_b'], anno - 1));
  // IVA già versata con riferimento: copre i trimestri in ordine.
  let ivaEsplicita = pagato(['iva'], anno);
  const residuoIva: Record<1 | 2 | 3, Cents> = { 1: 0, 2: 0, 3: 0 };
  for (const t of [1, 2, 3] as const) {
    const dovuta = opt.ivaTrimestri?.[t] ?? 0;
    const coperta = Math.min(dovuta, ivaEsplicita);
    residuoIva[t] = dovuta - coperta;
    ivaEsplicita -= coperta;
  }

  let dedotti = 0;
  let eccedenzeEnpam = 0;
  const aggiungi = (s: Spesa, importo: Cents, riferimento: RiferimentoVersamento) => {
    if (importo <= 0) return;
    versamenti.push({ spesaId: s.id, data: s.data, importo, riferimento, dedotto: true });
  };

  for (const s of delAnno) {
    if (s.riferimento) continue;
    const mese = isoMonth(s.data);
    let resto = s.importo;
    if (s.categoria === 'contributi_enpam') {
      dedotti++;
      if (mese >= 4) {
        let maxQuotaA = residuoQuotaA;
        if (opt.rateQuotaA && opt.rateQuotaB && rataQuotaBNelMese(opt.rateQuotaB, mese)) {
          const giaAttribuita = opt.quotaAAnnua - residuoQuotaA;
          maxQuotaA = Math.min(maxQuotaA, Math.max(0, quotaADovutaEntro(opt.rateQuotaA, opt.quotaAAnnua, mese) - giaAttribuita));
        }
        const a = Math.min(resto, maxQuotaA);
        aggiungi(s, a, { tributo: 'enpam_quota_a', anno });
        residuoQuotaA -= a;
        resto -= a;
      }
      if (mese <= 6) {
        aggiungi(s, resto, { tributo: 'enpam_quota_b', anno: anno - 2 });
      } else if (mese >= 10) {
        const b = Math.min(resto, residuoQuotaBPrec);
        aggiungi(s, b, { tributo: 'enpam_quota_b', anno: anno - 1 });
        residuoQuotaBPrec -= b;
        if (resto > b) eccedenzeEnpam++;
      } else if (resto > 0) {
        eccedenzeEnpam++;
      }
      continue;
    }
    // F24
    const trimestre = TRIMESTRE_IVA[mese];
    let ivaAttribuita = false;
    if (trimestre && residuoIva[trimestre] > 0) {
      const v = Math.min(resto, residuoIva[trimestre]);
      aggiungi(s, v, { tributo: 'iva', anno });
      residuoIva[trimestre] -= v;
      resto -= v;
      ivaAttribuita = true;
    }
    if (mese >= 6 && mese <= 8) {
      dedotti++;
      const saldo = Math.min(resto, residuoSaldoImposte);
      aggiungi(s, saldo, { tributo: 'imposta', anno: anno - 1, tipo: 'saldo' });
      residuoSaldoImposte -= saldo;
      resto -= saldo;
      const add = Math.min(resto, residuoSaldoAdd);
      aggiungi(s, add, { tributo: 'addizionale_regionale', anno: anno - 1, tipo: 'saldo' });
      residuoSaldoAdd -= add;
      resto -= add;
      aggiungi(s, resto, { tributo: 'imposta', anno, tipo: 'acconto' });
    } else if (mese >= 11) {
      dedotti++;
      aggiungi(s, resto, { tributo: 'imposta', anno, tipo: 'acconto' });
    } else {
      if (ivaAttribuita) dedotti++;
      if (resto > 0) nonAttribuiti.push(s);
    }
  }

  const avvisi: Avviso[] = [];
  if (dedotti > 0) {
    avvisi.push({
      codice: 'VERSAMENTI_DEDOTTI',
      livello: 'info',
      messaggio: `${dedotti} versamenti F24/ENPAM senza riferimento: attribuiti in base alla data. Indica a cosa si riferiscono per una stima precisa.`,
    });
  }
  if (nonAttribuiti.length > 0) {
    avvisi.push({
      codice: 'VERSAMENTI_NON_ATTRIBUITI',
      livello: 'attenzione',
      messaggio: `${nonAttribuiti.length} versamenti F24 senza riferimento non sono stati considerati nel "da accantonare". Indica a quale imposta e a quale anno si riferiscono.`,
    });
  }
  if (eccedenzeEnpam > 0) {
    avvisi.push({
      codice: 'VERSAMENTI_ENPAM_ECCEDENTI',
      livello: 'attenzione',
      messaggio: `${eccedenzeEnpam} versamenti ENPAM senza riferimento superano le rate dovute: la parte in eccesso non è stata considerata. Controlla che non siano registrati due volte o indica a cosa si riferiscono.`,
    });
  }
  return { versamenti, avvisi };
}

/** Somma dei versamenti per tributo, anno di riferimento ed eventualmente tipo (saldo/acconto). */
export function totaleVersato(
  versamenti: VersamentoAttribuito[],
  tributi: TributoVersamento[],
  annoRiferimento: number,
  tipo?: 'saldo' | 'acconto',
): Cents {
  return sum(versamenti
    .filter((v) => tributi.includes(v.riferimento.tributo) && v.riferimento.anno === annoRiferimento && (!tipo || v.riferimento.tipo === tipo))
    .map((v) => v.importo));
}
