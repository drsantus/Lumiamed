/**
 * CASI DI TEST FISCALI — fonte unica per i test automatici E per il file Excel
 * da far validare al commercialista (`npm run casi-test`).
 *
 * Se il commercialista corregge un "atteso", si modifica qui: i test diventano rossi
 * finché il motore non viene corretto.
 */
import { euro, type Cents } from '../money';
import type { DestinatarioFattura, Profilo, Spesa, TrattamentoIva } from '../types';

export interface ScenarioForfettario {
  id: string;
  descrizione: string;
  input: {
    anno: number;
    annoInizioAttivita: number;
    requisitiStartup5: boolean;
    ricavi: Cents;
    contributiVersati: Cents;
  };
  atteso: {
    redditoLordo: Cents;
    imponibile: Cents;
    aliquota: number;
    impostaSostitutiva: Cents;
  };
}

export const SCENARI_FORFETTARIO: ScenarioForfettario[] = [
  {
    id: 'F1',
    descrizione: 'Giovane medico al 5° anno con requisiti startup, 40.000 € incassati, 2.500 € di ENPAM versati',
    input: { anno: 2026, annoInizioAttivita: 2022, requisitiStartup5: true, ricavi: euro(40_000), contributiVersati: euro(2_500) },
    atteso: { redditoLordo: euro(31_200), imponibile: euro(28_700), aliquota: 0.05, impostaSostitutiva: euro(1_435) },
  },
  {
    id: 'F2',
    descrizione: 'Medico al 6° anno (aliquota 15%), 60.000 € incassati, 4.000 € di ENPAM versati',
    input: { anno: 2026, annoInizioAttivita: 2021, requisitiStartup5: true, ricavi: euro(60_000), contributiVersati: euro(4_000) },
    atteso: { redditoLordo: euro(46_800), imponibile: euro(42_800), aliquota: 0.15, impostaSostitutiva: euro(6_420) },
  },
  {
    id: 'F3',
    descrizione: 'Primo anno senza requisiti startup (15%), 25.000 € incassati, nessun contributo versato',
    input: { anno: 2026, annoInizioAttivita: 2026, requisitiStartup5: false, ricavi: euro(25_000), contributiVersati: 0 },
    atteso: { redditoLordo: euro(19_500), imponibile: euro(19_500), aliquota: 0.15, impostaSostitutiva: euro(2_925) },
  },
  {
    id: 'F4',
    descrizione: 'Contributi superiori al reddito: 5.000 € incassati, 5.000 € di ENPAM versati',
    input: { anno: 2026, annoInizioAttivita: 2025, requisitiStartup5: true, ricavi: euro(5_000), contributiVersati: euro(5_000) },
    atteso: { redditoLordo: euro(3_900), imponibile: 0, aliquota: 0.05, impostaSostitutiva: 0 },
  },
];

export interface ScenarioOrdinario {
  id: string;
  descrizione: string;
  input: {
    compensi: Cents;
    spese: { categoria: 'affitto_studio' | 'telefono_internet' | 'ristoranti_alberghi' | 'materiale_sanitario'; importo: Cents }[];
    contributiVersati: Cents;
    ritenute: Cents;
  };
  atteso: {
    speseDeducibili: Cents;
    redditoProfessionale: Cents;
    imponibile: Cents;
    impostaLorda: Cents;
    detrazioneLavoroAutonomo: Cents;
    impostaNetta: Cents;
    /** Addizionale regionale con tabella di prova a scaglioni (1,73% / 2,73% / 2,93% / 3,33%). */
    addizionaleRegionaleProva: Cents;
    /** Addizionale comunale di prova: 0,8% con esenzione (esclusione) fino a 10.000 €. */
    addizionaleComunaleProva: Cents;
  };
}

export const SCENARI_ORDINARIO: ScenarioOrdinario[] = [
  {
    id: 'O1',
    descrizione:
      'Specialista con 70.000 € di compensi; affitto 6.000, telefono 1.000 (80%), ristoranti 2.000 (75% ma max 2% dei compensi); ENPAM versato 8.000',
    input: {
      compensi: euro(70_000),
      spese: [
        { categoria: 'affitto_studio', importo: euro(6_000) },
        { categoria: 'telefono_internet', importo: euro(1_000) },
        { categoria: 'ristoranti_alberghi', importo: euro(2_000) },
      ],
      contributiVersati: euro(8_000),
      ritenute: 0,
    },
    atteso: {
      speseDeducibili: euro(8_200),
      redditoProfessionale: euro(61_800),
      imponibile: euro(53_800),
      impostaLorda: euro(15_334),
      detrazioneLavoroAutonomo: 0,
      impostaNetta: euro(15_334),
      addizionaleRegionaleProva: euro(1_385.54),
      addizionaleComunaleProva: euro(430.4),
    },
  },
  {
    id: 'O2',
    descrizione: 'Medico con 30.000 € di compensi, 4.000 € di materiale sanitario, 6.000 € di ENPAM versato, 2.000 € di ritenute subite',
    input: {
      compensi: euro(30_000),
      spese: [{ categoria: 'materiale_sanitario', importo: euro(4_000) }],
      contributiVersati: euro(6_000),
      ritenute: euro(2_000),
    },
    atteso: {
      // reddito 26.000; imponibile 20.000; lorda 4.600; detrazione 500 + 765 × (28.000 − 26.000) / 22.500 = 568,00
      speseDeducibili: euro(4_000),
      redditoProfessionale: euro(26_000),
      imponibile: euro(20_000),
      impostaLorda: euro(4_600),
      detrazioneLavoroAutonomo: euro(568),
      impostaNetta: euro(4_032),
      // 15.000 × 1,73% + 5.000 × 2,73% = 259,50 + 136,50
      addizionaleRegionaleProva: euro(396),
      addizionaleComunaleProva: euro(160),
    },
  },
];

export interface ScenarioQuotaB {
  id: string;
  descrizione: string;
  input: { annoReddito: number; dataNascita: string; redditoProfessionale: Cents };
  atteso: { soglia: Cents; totale: Cents };
}

export const SCENARI_QUOTA_B: ScenarioQuotaB[] = [
  {
    id: 'B1',
    descrizione: 'Under 40, reddito forfettario (LM34) 31.200 €: 19,5% sulla parte oltre 5.691,90 € (soglia 2026 stimata)',
    input: { annoReddito: 2026, dataNascita: '1991-05-10', redditoProfessionale: euro(31_200) },
    atteso: { soglia: 569_190, totale: 497_408 },
  },
  {
    id: 'B2',
    descrizione: 'Over 40, reddito 160.000 €: 19,5% fino a 150.000 (oltre la soglia 2026 stimata di 10.511,95) + 1% sull\'eccedenza',
    input: { annoReddito: 2026, dataNascita: '1975-01-01', redditoProfessionale: euro(160_000) },
    atteso: { soglia: 1_051_195, totale: 2_730_017 },
  },
  {
    id: 'B3',
    descrizione: 'Under 40 con reddito sotto la soglia: nessuna Quota B',
    input: { annoReddito: 2026, dataNascita: '1995-01-01', redditoProfessionale: euro(5_000) },
    atteso: { soglia: 569_190, totale: 0 },
  },
];

export interface ScenarioQuotaA {
  id: string;
  descrizione: string;
  input: { anno: number; dataNascita: string };
  atteso: { totale: Cents };
}

export const SCENARI_QUOTA_A: ScenarioQuotaA[] = [
  {
    id: 'A1',
    descrizione: 'Compie 30 anni il 15/3/2026: 3 mesi a 304,73 €/anno e 9 mesi a 591,47 €/anno, più maternità 84,26',
    input: { anno: 2026, dataNascita: '1996-03-15' },
    atteso: { totale: 60_405 },
  },
  {
    id: 'A2',
    descrizione: 'Over 40 tutto l\'anno: 2.049,83 + maternità 84,26',
    input: { anno: 2026, dataNascita: '1980-06-01' },
    atteso: { totale: 213_409 },
  },
];

export interface ScenarioAcconti {
  id: string;
  descrizione: string;
  input: { base: Cents };
  atteso: { modalita: 'nessuno' | 'unica_soluzione' | 'due_rate'; primaRata: Cents; secondaRata: Cents };
}

export const SCENARI_ACCONTI: ScenarioAcconti[] = [
  { id: 'AC1', descrizione: 'Imposta anno precedente 50 €: nessun acconto', input: { base: euro(50) }, atteso: { modalita: 'nessuno', primaRata: 0, secondaRata: 0 } },
  { id: 'AC2', descrizione: 'Imposta anno precedente 200 €: acconto unico a novembre', input: { base: euro(200) }, atteso: { modalita: 'unica_soluzione', primaRata: 0, secondaRata: euro(200) } },
  { id: 'AC3', descrizione: 'Imposta anno precedente 1.435 €: due rate da 50% (soggetti ISA/forfettari)', input: { base: euro(1_435) }, atteso: { modalita: 'due_rate', primaRata: euro(717.5), secondaRata: euro(717.5) } },
];

/**
 * SCENARI DELLA DASHBOARD — "da accantonare", impegni dell'anno scorso, guadagno netto.
 * Metodo (opzione 2, decisa il 13/10/2026):
 * - imposte maturate = imposta dell'anno intero stimata con la proiezione × frazione d'anno trascorsa;
 *   nei primi 60 giorni, se ci sono i dati dell'anno scorso: ricavi × aliquota effettiva dell'anno scorso;
 * - da accantonare = imposte maturate − ritenute − acconti versati + Quota A non versata
 *   + Quota B maturata (soglia e massimale in proporzione alla frazione d'anno) + IVA non versata;
 * - impegni dell'anno scorso = saldo imposte + saldo addizionali + Quota B non ancora pagati;
 * - guadagno netto = ricavi − spese (al netto dell'IVA detraibile) − imposte maturate − Quota A e Quota B maturate.
 * Gli attesi sono calcolati a parte (scripts/atteso_dashboard.py), non copiati dal motore.
 * Quota A 2026 da enpam.it (agg. 19/3/2026); Quota B: soglie dell'anno del reddito (2025 confermate, 2026 stimate).
 */
export interface IncassoScenario {
  data: string;
  imponibile: Cents;
  trattamentoIva: TrattamentoIva;
  destinatario: DestinatarioFattura;
  ritenuta?: Cents;
}

export interface ScenarioDashboard {
  id: string;
  descrizione: string;
  /** Dati di partenza in parole, per l'Excel del commercialista. */
  inputTesto: string;
  input: { oggi: string; profilo: Profilo; incassi: IncassoScenario[]; spese: Spesa[] };
  atteso: {
    metodo: 'proiezione' | 'anno_precedente';
    imposteMaturate: Cents;
    /** Imposte ancora da accantonare (dopo ritenute e acconti). */
    imposte: Cents;
    quotaAResidua: Cents;
    quotaBMaturata: Cents;
    iva: Cents;
    daAccantonare: Cents;
    impegniAnnoPrecedente?: Cents;
    guadagnoNetto: Cents;
  };
}

const mesi = (n: number, giorno: number, importo: Cents, extra: Partial<IncassoScenario> = {}): IncassoScenario[] =>
  Array.from({ length: n }, (_, i) => ({
    data: `2026-${String(i + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`,
    imponibile: importo, trattamentoIva: 'forfettario_no_iva', destinatario: 'paziente', ...extra,
  }));

const PROFILO_BASE = { rateQuotaA: 1, rateQuotaB: 1, emetteFattureElettroniche: false } as const;

const PREC_2025 = {
  anno: 2025, impostaDifferenza: euro(9_000), accontiVersati: euro(7_000), ricavi: euro(80_000), redditoProfessionale: euro(62_400),
};

export const SCENARI_DASHBOARD: ScenarioDashboard[] = [
  {
    id: 'D1',
    descrizione: 'Forfettario 15%, over 40, al 30 giugno: Quota A pagata, saldo 2025 e Quota B 2025 ancora da pagare',
    inputTesto: 'Oggi 30/6/2026. Nato nel 1975, attività dal 2018, aliquota 15%. Incassi 7.500 € al mese da gennaio a giugno (45.000 €). Quota A 2026 versata il 30/4 (2.134,09 €). Anno 2025: imposta 9.000 €, acconti versati 7.000 €, ricavi 80.000 €, reddito 62.400 €. Quota A e B in unica soluzione.',
    input: {
      oggi: '2026-06-30',
      profilo: { ...PROFILO_BASE, regime: 'forfettario', dataNascita: '1975-03-01', annoInizioAttivita: 2018, requisitiStartup5: false, annoPrecedente: PREC_2025 },
      incassi: mesi(6, 15, euro(7_500)),
      spese: [{ id: 'qa', data: '2026-04-30', importo: 213_409, categoria: 'contributi_enpam', riferimento: { tributo: 'enpam_quota_a', anno: 2026 } }],
    },
    atteso: {
      metodo: 'proiezione', imposteMaturate: 434_707, imposte: 434_707, quotaAResidua: 0,
      quotaBMaturata: 582_801, iva: 0, daAccantonare: 1_017_508,
      impegniAnnoPrecedente: 1_220_644, guadagnoNetto: 3_376_665,
    },
  },
  {
    id: 'D2',
    descrizione: 'Ordinario, over 40, al 30 settembre: compensi da strutture con ritenuta del 20%',
    inputTesto: 'Oggi 30/9/2026. Ordinario, Sardegna (addizionale regionale 1,23%), comune non impostato. Nato nel 1975. Compensi 6.000 € al mese da strutture (gennaio-settembre, esenti IVA) con ritenuta di 1.200 € ciascuno. Affitto studio 800 € al mese. Quota A versata il 30/4 (2.134,09 €). Nessun dato dell\'anno precedente.',
    input: {
      oggi: '2026-09-30',
      profilo: { ...PROFILO_BASE, regime: 'ordinario', dataNascita: '1975-03-01', annoInizioAttivita: 2015, requisitiStartup5: false, regione: 'SAR' },
      incassi: mesi(9, 10, euro(6_000), { trattamentoIva: 'esente_art10', destinatario: 'struttura', ritenuta: euro(1_200) }),
      spese: [
        ...Array.from({ length: 9 }, (_, i): Spesa => ({ id: `aff${i}`, data: `2026-${String(i + 1).padStart(2, '0')}-01`, importo: euro(800), categoria: 'affitto_studio' })),
        { id: 'qa', data: '2026-04-30', importo: 213_409, categoria: 'contributi_enpam', riferimento: { tributo: 'enpam_quota_a', anno: 2026 } },
      ],
    },
    atteso: {
      metodo: 'proiezione', imposteMaturate: 1_415_966, imposte: 335_966, quotaAResidua: 0,
      quotaBMaturata: 759_284, iva: 0, daAccantonare: 1_095_250, guadagnoNetto: 2_345_132,
    },
  },
  {
    id: 'D3',
    descrizione: 'Forfettario 5%, under 40, al 15 dicembre: saldo, acconti e Quota B già pagati (versamenti senza riferimento, attribuiti dalla data)',
    inputTesto: 'Oggi 15/12/2026. Nato nel 1990, attività dal 2023 con requisiti per il 5%. Incassi 5.000 € al mese (60.000 €). Anno 2025: imposta 2.000 €, nessun acconto, ricavi 50.000 €, reddito 39.000 €. Versamenti senza indicazione: ENPAM 1.194,18 € il 30/4; F24 3.000 € il 20/7; ENPAM 6.542,88 € il 2/11; F24 1.000 € il 30/11.',
    input: {
      oggi: '2026-12-15',
      profilo: {
        ...PROFILO_BASE, regime: 'forfettario', dataNascita: '1990-01-20', annoInizioAttivita: 2023, requisitiStartup5: true,
        annoPrecedente: { anno: 2025, impostaDifferenza: euro(2_000), accontiVersati: 0, ricavi: euro(50_000), redditoProfessionale: euro(39_000) },
      },
      incassi: mesi(12, 5, euro(5_000)),
      spese: [
        { id: 'v1', data: '2026-04-30', importo: 119_418, categoria: 'contributi_enpam' },
        { id: 'v2', data: '2026-07-20', importo: euro(3_000), categoria: 'imposte_f24' },
        { id: 'v3', data: '2026-11-02', importo: euro(6_542.88), categoria: 'contributi_enpam' },
        { id: 'v4', data: '2026-11-30', importo: euro(1_000), categoria: 'imposte_f24' },
      ],
    },
    atteso: {
      metodo: 'proiezione', imposteMaturate: 197_011, imposte: 0, quotaAResidua: 0,
      quotaBMaturata: 806_473, iva: 0, daAccantonare: 806_473,
      impegniAnnoPrecedente: 0, guadagnoNetto: 4_882_333,
    },
  },
  {
    id: 'D4',
    descrizione: 'Ordinario, over 40, al 30 giugno: 18.000 € esenti e una perizia da 12.000 € con IVA 22% non ancora versata',
    inputTesto: 'Oggi 30/6/2026. Ordinario, Sardegna, nato nel 1975. Incassati 18.000 € esenti il 10/3 e 12.000 € + IVA 22% il 12/5 (perizia). Nessuna spesa, Quota A non ancora versata. IVA del 2° trimestre (2.640 € + 1% di interessi) da versare il 20/8.',
    input: {
      oggi: '2026-06-30',
      profilo: { ...PROFILO_BASE, regime: 'ordinario', dataNascita: '1975-03-01', annoInizioAttivita: 2015, requisitiStartup5: false, regione: 'SAR' },
      incassi: [
        { data: '2026-03-10', imponibile: euro(18_000), trattamentoIva: 'esente_art10', destinatario: 'paziente' },
        { data: '2026-05-12', imponibile: euro(12_000), trattamentoIva: 'imponibile_22', destinatario: 'struttura' },
      ],
      spese: [],
    },
    atteso: {
      metodo: 'proiezione', imposteMaturate: 893_298, imposte: 893_298, quotaAResidua: 213_409,
      quotaBMaturata: 483_351, iva: 266_640, daAccantonare: 1_856_698, guadagnoNetto: 1_517_524,
    },
  },
  {
    id: 'D5',
    descrizione: 'Forfettario 15%, over 40, al 20 febbraio: pochi dati, imposte stimate con l\'aliquota effettiva del 2025 (9.000 / 80.000 = 11,25%)',
    inputTesto: 'Oggi 20/2/2026 (51° giorno: proiezione non affidabile). Nato nel 1975, aliquota 15%. Incassati 7.000 € il 15/1 e 6.000 € il 10/2. Anno 2025: imposta 9.000 €, acconti 7.000 €, ricavi 80.000 €, reddito 62.400 €. Nessun versamento nel 2026.',
    input: {
      oggi: '2026-02-20',
      profilo: { ...PROFILO_BASE, regime: 'forfettario', dataNascita: '1975-03-01', annoInizioAttivita: 2018, requisitiStartup5: false, annoPrecedente: PREC_2025 },
      incassi: [
        { data: '2026-01-15', imponibile: euro(7_000), trattamentoIva: 'forfettario_no_iva', destinatario: 'paziente' },
        { data: '2026-02-10', imponibile: euro(6_000), trattamentoIva: 'forfettario_no_iva', destinatario: 'paziente' },
      ],
      spese: [],
    },
    atteso: {
      metodo: 'anno_precedente', imposteMaturate: 146_250, imposte: 146_250, quotaAResidua: 213_409,
      quotaBMaturata: 169_089, iva: 0, daAccantonare: 528_748,
      impegniAnnoPrecedente: 1_220_644, guadagnoNetto: 954_842,
    },
  },
];
