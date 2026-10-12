/**
 * CASI DI TEST FISCALI — fonte unica per i test automatici E per il file Excel
 * da far validare al commercialista (`npm run casi-test`).
 *
 * Se il commercialista corregge un "atteso", si modifica qui: i test diventano rossi
 * finché il motore non viene corretto.
 */
import { euro, type Cents } from '../money';

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
    descrizione: 'Under 40, reddito forfettario (LM34) 31.200 €: 19,5% sulla parte oltre 5.446,77 €',
    input: { annoReddito: 2026, dataNascita: '1991-05-10', redditoProfessionale: euro(31_200) },
    atteso: { soglia: euro(5_446.77), totale: euro(5_021.88) },
  },
  {
    id: 'B2',
    descrizione: 'Over 40, reddito 160.000 €: 19,5% fino a 150.000 (oltre la soglia di 10.059,28) + 1% sull\'eccedenza',
    input: { annoReddito: 2026, dataNascita: '1975-01-01', redditoProfessionale: euro(160_000) },
    atteso: { soglia: euro(10_059.28), totale: euro(27_388.44) },
  },
  {
    id: 'B3',
    descrizione: 'Under 40 con reddito sotto la soglia: nessuna Quota B',
    input: { annoReddito: 2026, dataNascita: '1995-01-01', redditoProfessionale: euro(5_000) },
    atteso: { soglia: euro(5_446.77), totale: 0 },
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
    descrizione: 'Compie 30 anni il 15/3/2026: 3 mesi a 291,61 €/anno e 9 mesi a 566 €/anno, più maternità 95,54',
    input: { anno: 2026, dataNascita: '1996-03-15' },
    atteso: { totale: euro(592.94) },
  },
  {
    id: 'A2',
    descrizione: 'Over 40 tutto l\'anno: 1.961,56 + maternità 95,54',
    input: { anno: 2026, dataNascita: '1980-06-01' },
    atteso: { totale: euro(2_057.1) },
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
