import type { Cents } from './money';

export type Regime = 'forfettario' | 'ordinario';

/** Date sempre in formato ISO "YYYY-MM-DD". */
export type IsoDate = string;

export interface Profilo {
  regime: Regime;
  /** Data di nascita (serve per la fascia della Quota A e per la soglia della Quota B). */
  dataNascita: IsoDate;
  /** Anno di apertura della partita IVA. */
  annoInizioAttivita: number;
  /**
   * Forfettario: true se il medico ha i requisiti per l'aliquota agevolata del 5%
   * (nuova attività, nessuna attività analoga nei 3 anni precedenti, ecc.).
   * Lo dichiara l'utente: il motore non può verificarlo.
   */
  requisitiStartup5: boolean;
  /** Coefficiente di redditività forfettario. Default 0.78 (ATECO 86.21 / 86.22 / 86.23). */
  coefficienteRedditivita?: number;
  /** Codice catastale del comune di domicilio fiscale (es. "G962"), per l'addizionale comunale. */
  comuneCodiceCatastale?: string;
  /** Regione di domicilio fiscale, per l'addizionale regionale. */
  regione?: RegioneCode;
  /** Rate scelte per la Quota A ENPAM. */
  rateQuotaA: 1 | 4 | 8;
  /** Rate scelte per la Quota B ENPAM. */
  rateQuotaB: 1 | 2 | 5 | 9;
  /** Emette fatture elettroniche (verso strutture/aziende)? Serve per il bollo virtuale trimestrale. */
  emetteFattureElettroniche: boolean;
  /**
   * Dati dell'anno precedente, da inserire il primo anno (poi li calcola l'app).
   * Servono per gli acconti con metodo storico.
   */
  annoPrecedente?: DatiAnnoPrecedente;
}

export interface DatiAnnoPrecedente {
  anno: number;
  /** "Rigo differenza": imposta netta meno ritenute subite (IRPEF o imposta sostitutiva). */
  impostaDifferenza: Cents;
  /** Addizionale comunale dovuta (solo ordinario), per l'acconto del 30%. */
  addizionaleComunale?: Cents;
  /** Ricavi/compensi dell'anno precedente (controllo limite 85k€ forfettario). */
  ricavi?: Cents;
  /** Acconti già versati per l'anno precedente (per calcolare il saldo). */
  accontiVersati?: Cents;
  /** Reddito libero-professionale dell'anno precedente (base della Quota B pagata quest'anno). */
  redditoProfessionale?: Cents;
  /** Ritenute d'acconto subite l'anno precedente (solo ordinario): servono per l'aliquota effettiva. */
  ritenute?: Cents;
  /** Addizionale regionale dovuta per l'anno precedente (solo ordinario): si paga tutta a saldo. */
  addizionaleRegionale?: Cents;
  /** Acconto dell'addizionale comunale già versato per l'anno precedente. Se assente si stima il 30%. */
  accontoAddizionaleComunaleVersato?: Cents;
}

export type RegioneCode =
  | 'ABR' | 'BAS' | 'CAL' | 'CAM' | 'EMR' | 'FVG' | 'LAZ' | 'LIG' | 'LOM' | 'MAR'
  | 'MOL' | 'PIE' | 'PUG' | 'SAR' | 'SIC' | 'TOS' | 'TAA_TN' | 'TAA_BZ' | 'UMB' | 'VDA' | 'VEN';

/** Trattamento IVA della singola prestazione. */
export type TrattamentoIva =
  /** Prestazione sanitaria di diagnosi, cura e riabilitazione: esente art. 10 n. 18 DPR 633/72. */
  | 'esente_art10'
  /** Prestazione non sanitaria (medicina estetica non terapeutica, perizie, certificati medico-legali): IVA 22%. */
  | 'imponibile_22'
  /** Forfettario: operazione senza IVA ai sensi dell'art. 1 c. 54-89 L. 190/2014. */
  | 'forfettario_no_iva';

export type DestinatarioFattura = 'paziente' | 'struttura';

export type StatoFattura = 'da_incassare' | 'incassata';

export interface Fattura {
  id: string;
  numero: string;
  dataFattura: IsoDate;
  /** Imponibile della prestazione, IVA e bollo esclusi. */
  imponibile: Cents;
  trattamentoIva: TrattamentoIva;
  /** IVA addebitata (0 se esente o forfettario). Se assente la calcola il motore. */
  iva?: Cents;
  /** Marca da bollo da 2€ addebitata al cliente. */
  bolloAddebitato: boolean;
  destinatario: DestinatarioFattura;
  /** Ritenuta d'acconto subita (ordinario, fatture a strutture sostituti d'imposta). */
  ritenutaAcconto?: Cents;
  /** Facoltativo. ATTENZIONE: insieme al tipo di prestazione è un dato sanitario (art. 9 GDPR). */
  nomePaziente?: string;
  tipoPrestazione?: string;
  elettronica: boolean;
  stato: StatoFattura;
  dataIncasso?: IsoDate;
  /** Già trasmessa al Sistema Tessera Sanitaria. */
  inviataSTS?: boolean;
  /** Origine del dato: inserimento manuale o lettura da foto. */
  origine: 'manuale' | 'foto';
}

export type CategoriaSpesa =
  | 'affitto_studio'
  | 'utenze'
  | 'materiale_sanitario'
  | 'attrezzature'
  | 'assicurazione_rc'
  | 'formazione_ecm'
  | 'software'
  | 'telefono_internet'
  | 'auto'
  | 'ristoranti_alberghi'
  | 'commercialista'
  | 'quota_ordine'
  | 'personale'
  | 'contributi_enpam'
  | 'imposte_f24'
  | 'personale_non_deducibile'
  | 'altro';

/** Tributo a cui si riferisce un versamento con F24 o a ENPAM. */
export type TributoVersamento =
  /** IRPEF (ordinario) o imposta sostitutiva (forfettario). */
  | 'imposta'
  | 'addizionale_regionale'
  | 'addizionale_comunale'
  | 'iva'
  | 'enpam_quota_a'
  | 'enpam_quota_b';

export interface RiferimentoVersamento {
  tributo: TributoVersamento;
  /**
   * Anno di competenza: anno d'imposta per imposte, addizionali e IVA;
   * anno del contributo per la Quota A; anno del REDDITO per la Quota B
   * (la Quota B pagata a ottobre 2026 ha anno 2025).
   */
  anno: number;
  /** Imposte e addizionali: saldo dell'anno indicato oppure acconto. */
  tipo?: 'saldo' | 'acconto';
}

export interface Spesa {
  id: string;
  /** Data del pagamento (principio di cassa). */
  data: IsoDate;
  /** Importo totale pagato, IVA inclusa. */
  importo: Cents;
  /** IVA contenuta nell'importo (per la detrazione nell'ordinario). */
  iva?: Cents;
  categoria: CategoriaSpesa;
  descrizione?: string;
  /** Percentuale di deducibilità personalizzata (0-1). Se assente usa quella della categoria. */
  deducibilitaPersonalizzata?: number;
  /**
   * Solo per le categorie 'imposte_f24' e 'contributi_enpam': a cosa si riferisce il versamento.
   * L'interfaccia deve chiederlo. Se manca, il motore lo attribuisce in base alla data e lo segnala.
   */
  riferimento?: RiferimentoVersamento;
}

export interface Avviso {
  codice: string;
  livello: 'info' | 'attenzione' | 'critico';
  messaggio: string;
}
