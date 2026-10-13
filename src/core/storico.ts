import { isoYear, lastDayOfMonth, ymd } from './dates';
import type { Cents } from './money';
import { parseImporto } from './ocr/parseInvoiceText';
import type { CategoriaSpesa, DestinatarioFattura, Fattura, IsoDate, Spesa, TrattamentoIva } from './types';

/**
 * Caricamento rapido dei dati da inizio anno, in tre modalità:
 * - totali mese per mese;
 * - import di un file CSV (con anteprima: il motore non salva nulla, restituisce i movimenti da confermare);
 * - totale da inizio anno come unica cifra.
 * I movimenti generati hanno `storico: true` e si possono dettagliare dopo.
 * Gli importi degli incassi sono imponibili (IVA e bollo esclusi).
 */

export interface OpzioniStorico {
  /** Anno dei dati caricati. */
  anno: number;
  oggi: IsoDate;
  /** Trattamento IVA degli incassi (forfettario: 'forfettario_no_iva'; ordinario: di solito 'esente_art10'). */
  trattamentoIva: TrattamentoIva;
  /** Default 'paziente'. */
  destinatario?: DestinatarioFattura;
  /** Prefisso degli id generati: il motore non genera id casuali. */
  prefissoId: string;
}

export interface CaricamentoStorico {
  fatture: Fattura[];
  spese: Spesa[];
  /** Errori che impediscono il caricamento: se presenti, fatture e spese sono vuote. */
  errori: string[];
}

export const CATEGORIE_SPESA: readonly CategoriaSpesa[] = [
  'affitto_studio', 'utenze', 'materiale_sanitario', 'attrezzature', 'assicurazione_rc', 'formazione_ecm', 'software',
  'telefono_internet', 'auto', 'ristoranti_alberghi', 'commercialista', 'quota_ordine', 'personale', 'contributi_enpam',
  'imposte_f24', 'personale_non_deducibile', 'altro',
];

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const importoValido = (c: Cents | undefined): boolean => c === undefined || (Number.isInteger(c) && c >= 0);

function fatturaStorico(id: string, data: IsoDate, imponibile: Cents, opt: OpzioniStorico, extra: Partial<Fattura> = {}): Fattura {
  return {
    id, numero: id, dataFattura: data, imponibile, trattamentoIva: opt.trattamentoIva, bolloAddebitato: false,
    destinatario: opt.destinatario ?? 'paziente', elettronica: false, stato: 'incassata', dataIncasso: data,
    origine: 'manuale', storico: true, ...extra,
  };
}

const spesaStorico = (id: string, data: IsoDate, importo: Cents, categoria: CategoriaSpesa, descrizione?: string): Spesa => ({
  id, data, importo, categoria, storico: true, ...(descrizione ? { descrizione } : {}),
});

/** Totali di un periodo: incassi, ritenute subite e spese per categoria. */
export interface TotaliPeriodo {
  incassi: Cents;
  ritenute?: Cents;
  spese?: Partial<Record<CategoriaSpesa, Cents>>;
}

function controllaTotali(t: TotaliPeriodo, dove: string): string[] {
  const errori: string[] = [];
  if (!importoValido(t.incassi)) errori.push(`${dove}: importo degli incassi non valido.`);
  if (!importoValido(t.ritenute)) errori.push(`${dove}: importo delle ritenute non valido.`);
  else if (importoValido(t.incassi) && (t.ritenute ?? 0) > t.incassi) errori.push(`${dove}: le ritenute superano gli incassi.`);
  for (const [cat, v] of Object.entries(t.spese ?? {})) {
    if (!CATEGORIE_SPESA.includes(cat as CategoriaSpesa)) errori.push(`${dove}: categoria di spesa sconosciuta (${cat}).`);
    else if (!importoValido(v)) errori.push(`${dove}: importo non valido per ${cat}.`);
  }
  return errori;
}

/** Movimenti di un periodo, tutti alla stessa data. Gli importi a zero non generano movimenti. */
function movimentiPeriodo(t: TotaliPeriodo, data: IsoDate, chiave: string, opt: OpzioniStorico): { fatture: Fattura[]; spese: Spesa[] } {
  const fatture = t.incassi > 0
    ? [fatturaStorico(`${opt.prefissoId}-${chiave}`, data, t.incassi, opt, t.ritenute ? { ritenutaAcconto: t.ritenute } : {})]
    : [];
  const spese = CATEGORIE_SPESA
    .filter((cat) => (t.spese?.[cat] ?? 0) > 0)
    .map((cat) => spesaStorico(`${opt.prefissoId}-${chiave}-${cat}`, data, t.spese?.[cat] as Cents, cat));
  return { fatture, spese };
}

function controllaAnno(opt: OpzioniStorico): string[] {
  return opt.anno > isoYear(opt.oggi) ? [`Il ${opt.anno} non è ancora iniziato.`] : [];
}

export interface TotaliMese extends TotaliPeriodo {
  /** 1 = gennaio. */
  mese: number;
}

/**
 * Totali mese per mese. Ogni mese diventa un incasso e una spesa per categoria,
 * datati all'ultimo giorno del mese (o a oggi, per il mese in corso).
 */
export function storicoDaTotaliMensili(mesi: TotaliMese[], opt: OpzioniStorico): CaricamentoStorico {
  const errori = controllaAnno(opt);
  const visti = new Set<number>();
  for (const m of mesi) {
    if (!Number.isInteger(m.mese) || m.mese < 1 || m.mese > 12) {
      errori.push(`Mese ${m.mese} non valido.`);
      continue;
    }
    const nome = MESI[m.mese - 1];
    if (visti.has(m.mese)) errori.push(`Il mese di ${nome} è inserito due volte.`);
    visti.add(m.mese);
    if (ymd(opt.anno, m.mese, 1) > opt.oggi) errori.push(`Il mese di ${nome} ${opt.anno} non è ancora iniziato.`);
    errori.push(...controllaTotali(m, `${nome[0].toUpperCase()}${nome.slice(1)}`));
  }
  if (errori.length > 0) return { fatture: [], spese: [], errori };

  const fatture: Fattura[] = [];
  const spese: Spesa[] = [];
  for (const m of [...mesi].sort((a, b) => a.mese - b.mese)) {
    const fine = lastDayOfMonth(opt.anno, m.mese);
    const mov = movimentiPeriodo(m, fine < opt.oggi ? fine : opt.oggi, `${opt.anno}-${String(m.mese).padStart(2, '0')}`, opt);
    fatture.push(...mov.fatture);
    spese.push(...mov.spese);
  }
  return { fatture, spese, errori: [] };
}

/** Totale da inizio anno come unica cifra: un movimento per voce, datato oggi (o al 31/12 per un anno passato). */
export function storicoDaTotaleAnno(totale: TotaliPeriodo, opt: OpzioniStorico): CaricamentoStorico {
  const errori = [...controllaAnno(opt), ...controllaTotali(totale, 'Totale da inizio anno')];
  if (errori.length > 0) return { fatture: [], spese: [], errori };
  const data = opt.anno === isoYear(opt.oggi) ? opt.oggi : ymd(opt.anno, 12, 31);
  return { ...movimentiPeriodo(totale, data, `${opt.anno}-totale`, opt), errori: [] };
}

// ───────────────────────── Import CSV ─────────────────────────

/** Intestazione del file modello. Colonne obbligatorie: data, tipo, importo. */
export const MODELLO_CSV = 'data;tipo;importo;categoria;descrizione';

export interface RigaScartata {
  /** Numero di riga nel file (1 = intestazione). */
  riga: number;
  testo: string;
  motivo: string;
}

export interface AnteprimaImportCsv extends CaricamentoStorico {
  separatore: ';' | ',';
  /** Righe di dati lette (escluse intestazione e righe vuote). */
  righeLette: number;
  scartate: RigaScartata[];
  totaleIncassi: Cents;
  totaleSpese: Cents;
}

/** Divide una riga CSV rispettando le virgolette ("" = virgoletta). undefined se una virgoletta non è chiusa. */
function dividiRiga(riga: string, sep: string): string[] | undefined {
  const celle: string[] = [];
  let cella = '';
  let tra = false;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (tra) {
      if (c === '"' && riga[i + 1] === '"') { cella += '"'; i++; } else if (c === '"') tra = false; else cella += c;
    } else if (c === '"') tra = true;
    else if (c === sep) { celle.push(cella); cella = ''; } else cella += c;
  }
  if (tra) return undefined;
  celle.push(cella);
  return celle.map((x) => x.trim());
}

/** "gg/mm/aaaa" → ISO, con controllo del giorno nel mese. */
export function parseDataItaliana(testo: string): IsoDate | undefined {
  const m = testo.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [g, mese, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mese < 1 || mese > 12 || g < 1) return undefined;
  const iso = ymd(a, mese, g);
  return iso <= lastDayOfMonth(a, mese) ? iso : undefined;
}

/**
 * Anteprima dell'import CSV. Formato:
 * - prima riga di intestazione con almeno `data`, `tipo`, `importo` (facoltative `categoria`, `descrizione`);
 * - separatore `;` o `,` (riconosciuto dall'intestazione); con la virgola gli importi decimali vanno tra virgolette;
 * - date gg/mm/aaaa; importi con la virgola decimale ("1.234,56");
 * - tipo: `incasso` o `spesa`; categoria: codice di `CategoriaSpesa` (vuota = 'altro').
 * Le righe non valide sono scartate con il motivo; le altre diventano movimenti con `storico: true`.
 */
export function anteprimaImportCsv(testo: string, opt: OpzioniStorico): AnteprimaImportCsv {
  const righe = testo.replace(/^﻿/, '').split(/\r?\n/);
  const vuota = (sep: ';' | ',', errori: string[]): AnteprimaImportCsv => ({
    fatture: [], spese: [], errori, separatore: sep, righeLette: 0, scartate: [], totaleIncassi: 0, totaleSpese: 0,
  });
  const iIntestazione = righe.findIndex((r) => r.trim() !== '');
  if (iIntestazione < 0) return vuota(';', ['Il file è vuoto.']);
  const intestazione = righe[iIntestazione];
  const separatore: ';' | ',' = intestazione.includes(';') ? ';' : ',';
  const colonne = (dividiRiga(intestazione, separatore) ?? []).map((c) => c.toLowerCase());
  const indice = (nome: string) => colonne.indexOf(nome);
  const mancanti = ['data', 'tipo', 'importo'].filter((c) => indice(c) < 0);
  if (mancanti.length > 0) {
    return vuota(separatore, [`Nell'intestazione manca ${mancanti.map((c) => `la colonna "${c}"`).join(', ')}. Modello: ${MODELLO_CSV}`]);
  }
  const errori = controllaAnno(opt);
  if (errori.length > 0) return vuota(separatore, errori);

  const fatture: Fattura[] = [];
  const spese: Spesa[] = [];
  const scartate: RigaScartata[] = [];
  let righeLette = 0;
  for (let i = iIntestazione + 1; i < righe.length; i++) {
    const testoRiga = righe[i];
    if (testoRiga.trim() === '') continue;
    righeLette++;
    const numero = i + 1;
    const scarta = (motivo: string) => scartate.push({ riga: numero, testo: testoRiga, motivo });
    const celle = dividiRiga(testoRiga, separatore);
    if (!celle) { scarta('virgolette non chiuse'); continue; }
    if (celle.length > colonne.length) {
      scarta(separatore === ','
        ? 'più colonne dell\'intestazione: con la virgola come separatore metti gli importi tra virgolette'
        : 'più colonne dell\'intestazione');
      continue;
    }
    const cella = (nome: string) => (indice(nome) >= 0 ? celle[indice(nome)] ?? '' : '');
    const data = parseDataItaliana(cella('data'));
    if (!data) { scarta('data non valida: usa gg/mm/aaaa'); continue; }
    if (isoYear(data) !== opt.anno) { scarta(`data fuori dal ${opt.anno}`); continue; }
    if (data > opt.oggi) { scarta('data futura'); continue; }
    const tipo = cella('tipo').toLowerCase();
    if (tipo !== 'incasso' && tipo !== 'spesa') { scarta('tipo non valido: usa "incasso" o "spesa"'); continue; }
    const importo = parseImporto(cella('importo'));
    if (importo === undefined) { scarta('importo non valido'); continue; }
    if (importo <= 0) { scarta('l\'importo deve essere maggiore di zero'); continue; }
    const descrizione = cella('descrizione') || undefined;
    const id = `${opt.prefissoId}-r${numero}`;
    if (tipo === 'incasso') {
      fatture.push(fatturaStorico(id, data, importo, opt, descrizione ? { tipoPrestazione: descrizione } : {}));
      continue;
    }
    const categoria = (cella('categoria').toLowerCase() || 'altro') as CategoriaSpesa;
    if (!CATEGORIE_SPESA.includes(categoria)) { scarta(`categoria sconosciuta: ${cella('categoria')}`); continue; }
    spese.push(spesaStorico(id, data, importo, categoria, descrizione));
  }
  return {
    fatture, spese, errori: [], separatore, righeLette, scartate,
    totaleIncassi: fatture.reduce((t, f) => t + f.imponibile, 0),
    totaleSpese: spese.reduce((t, s) => t + s.importo, 0),
  };
}
