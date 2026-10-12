import type { Cents } from '../money';
import type { CategoriaSpesa, IsoDate } from '../types';

/**
 * Ogni gruppo di parametri dichiara la fonte e se è stato verificato dal commercialista.
 * Finché `verificato` è false l'app deve mostrare i calcoli come "stima".
 */
export interface Fonte {
  fonte: string;
  verificato: boolean;
  nota?: string;
}

export interface Scaglione {
  /** Limite superiore dello scaglione in centesimi; null = nessun limite. */
  fino: Cents | null;
  aliquota: number;
}

export interface ParametriAnno {
  anno: number;

  forfettario: Fonte & {
    limiteRicavi: Cents; // 85.000
    limiteUscitaImmediata: Cents; // 100.000
    coefficienteDefault: number; // 0.78
    aliquotaStartup: number; // 0.05
    anniStartup: number; // 5
    aliquotaOrdinaria: number; // 0.15
  };

  irpef: Fonte & {
    scaglioni: Scaglione[];
  };

  detrazioneLavoroAutonomo: Fonte & {
    // art. 13 c. 5 TUIR
    soglia1: Cents; // 5.500
    importo1: Cents; // 1.265
    soglia2: Cents; // 28.000
    base2: Cents; // 500
    variabile2: Cents; // 765
    soglia3: Cents; // 50.000
    base3: Cents; // 500
  };

  acconti: Fonte & {
    sogliaNessunAcconto: Cents; // 51,65
    sogliaUnicaSoluzione: Cents; // 257,52
    percentuale: number; // 1.00
    /** Soggetti ISA e forfettari: 50% + 50%. */
    primaRataIsa: number; // 0.5
    accontoAddizionaleComunale: number; // 0.30
  };

  enpam: Fonte & {
    quotaA: {
      /** Importi annui per fascia d'età (anni compiuti). */
      fasce: { finoEta: number | null; importoAnnuo: Cents }[];
      contributoMaternita: Cents;
    };
    quotaB: {
      aliquotaIntera: number; // 0.195
      aliquotaOltreMassimale: number; // 0.01
      massimale: Cents; // 150.000
      /** Reddito già coperto dalla Quota A (esente da Quota B). */
      sogliaUnder40: Cents;
      sogliaOver40: Cents;
    };
  };

  iva: Fonte & {
    aliquotaOrdinaria: number; // 0.22
    interessiTrimestrali: number; // 0.01
  };

  bollo: Fonte & {
    soglia: Cents; // 77,47
    importo: Cents; // 2,00
    /** Il bollo riaddebitato al cliente concorre a ricavi/compensi? (D.Lgs. 192/2024: rimborsi spese esclusi) */
    addebitatoConcorreAlReddito: boolean;
  };

  spese: Fonte & {
    deducibilita: Record<CategoriaSpesa, number>;
    /** Ristoranti e alberghi: deducibili al 75% entro il 2% dei compensi. */
    limiteRistorantiSuCompensi: number;
    /** Formazione: limite annuo. */
    limiteFormazione: Cents;
  };

  scadenze: Fonte & {
    /** Saldo e primo acconto imposte per ISA e forfettari (eventuale proroga). */
    saldoPrimoAccontoIsa: IsoDate;
    secondoAcconto: IsoDate;
    dichiarazioneRedditi: IsoDate;
    invioSTS: IsoDate; // invio spese anno precedente
    modelloD: IsoDate;
  };
}
