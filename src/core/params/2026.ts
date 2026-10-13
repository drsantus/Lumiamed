import { euro } from '../money';
import type { ParametriAnno } from './types';

/**
 * PARAMETRI 2026 — da far verificare al commercialista.
 * Quando un gruppo è stato verificato, mettere `verificato: true`.
 */
export const PARAMETRI_2026: ParametriAnno = {
  anno: 2026,

  forfettario: {
    fonte: 'L. 190/2014 art. 1 c. 54-89; coefficiente ATECO 86.2x = 78%',
    verificato: false,
    limiteRicavi: euro(85_000),
    limiteUscitaImmediata: euro(100_000),
    coefficienteDefault: 0.78,
    aliquotaStartup: 0.05,
    anniStartup: 5,
    aliquotaOrdinaria: 0.15,
    sogliaRedditiDipendente: {
      fonte: 'L. 190/2014 art. 1 c. 57 lett. d-ter',
      verificato: false,
      nota: 'Da confermare dal commercialista.',
      importo: euro(35_000),
    },
  },

  irpef: {
    fonte: 'L. 199/2025 (Legge di Bilancio 2026) art. 1 c. 3',
    verificato: false,
    scaglioni: [
      { fino: euro(28_000), aliquota: 0.23 },
      { fino: euro(50_000), aliquota: 0.33 },
      { fino: null, aliquota: 0.43 },
    ],
  },

  detrazioneLavoroAutonomo: {
    fonte: 'Art. 13 c. 5 TUIR',
    verificato: false,
    soglia1: euro(5_500),
    importo1: euro(1_265),
    soglia2: euro(28_000),
    base2: euro(500),
    variabile2: euro(765),
    soglia3: euro(50_000),
    base3: euro(500),
  },

  acconti: {
    fonte: 'Art. 17 DPR 435/2001; soggetti ISA e forfettari in due rate da 50%',
    verificato: false,
    sogliaNessunAcconto: euro(51.65),
    sogliaUnicaSoluzione: euro(257.52),
    percentuale: 1,
    primaRataIsa: 0.5,
    accontoAddizionaleComunale: 0.3,
  },

  enpam: {
    fonte: 'Quota B: istruzioni Modello D 2026 (Giornale della Previdenza) e enpam.it',
    verificato: false,
    nota: 'Aliquote e massimale della Quota B da verificare.',
    quotaA: {
      fonte: 'enpam.it',
      verificato: true,
      nota: 'enpam.it agg. 19/3/2026',
      fasce: [
        { finoEta: 29, importoAnnuo: 30_473 }, // fino a 30 anni
        { finoEta: 34, importoAnnuo: 59_147 }, // da 30 a 35
        { finoEta: 39, importoAnnuo: 110_992 }, // da 35 a 40
        { finoEta: null, importoAnnuo: 204_983 }, // oltre 40
      ],
      contributoMaternita: 8_426,
      studenti: 15_237,
    },
    quotaB: {
      aliquotaIntera: 0.195,
      aliquotaOltreMassimale: 0.01,
      massimale: euro(150_000),
      sogliaEsenzione: {
        fonte: 'Stima LumiaMed',
        verificato: false,
        nota: 'Stima: Quota A 2026 ÷ 19,5%. ENPAM la pubblica con il Modello D 2027',
        under40: 569_190,
        over40: 1_051_195,
      },
    },
  },

  detrazioneLavoroDipendente: {
    fonte: 'Art. 13 c. 1 TUIR',
    verificato: false,
    nota: 'Usata solo per l\'avviso sugli altri redditi nell\'ordinario: la detrazione per lavoro dipendente non è calcolata.',
    nullaOltre: euro(50_000),
  },

  iva: {
    fonte: 'DPR 633/72; art. 10 n. 18 esenzione prestazioni sanitarie',
    verificato: false,
    aliquotaOrdinaria: 0.22,
    interessiTrimestrali: 0.01,
  },

  bollo: {
    fonte: 'DPR 642/72, tariffa art. 13',
    verificato: false,
    nota:
      'D.Lgs. 192/2024: dal 2025 i rimborsi di spese addebitate al cliente non concorrono al reddito di lavoro autonomo. Verificare se vale anche per il bollo e per i forfettari.',
    soglia: euro(77.47),
    importo: euro(2),
    addebitatoConcorreAlReddito: false,
  },

  spese: {
    fonte: 'Art. 54 TUIR (prima della riforma D.Lgs. 192/2024: verificare le novità sul reddito di lavoro autonomo)',
    verificato: false,
    deducibilita: {
      affitto_studio: 1,
      utenze: 1,
      materiale_sanitario: 1,
      attrezzature: 1, // ATTENZIONE: beni oltre 516,46 € vanno ammortizzati
      assicurazione_rc: 1,
      formazione_ecm: 1,
      software: 1,
      telefono_internet: 0.8,
      auto: 0.2, // con limite di costo 18.075,99 € — non gestito nell'MVP
      ristoranti_alberghi: 0.75,
      commercialista: 1,
      quota_ordine: 1,
      personale: 1,
      contributi_enpam: 0, // onere deducibile, gestito a parte
      imposte_f24: 0,
      personale_non_deducibile: 0,
      altro: 1,
    },
    limiteRistorantiSuCompensi: 0.02,
    limiteFormazione: euro(10_000),
  },

  scadenze: {
    fonte: 'Proroga ISA/forfettari 2026 al 20 luglio (edotto.com, centrofiscale.com); Modello D: istruzioni ENPAM 2026',
    verificato: false,
    saldoPrimoAccontoIsa: '2026-07-20',
    secondoAcconto: '2026-11-30',
    dichiarazioneRedditi: '2026-10-31',
    invioSTS: '2026-01-31',
    modelloD: '2026-07-31',
  },
};
