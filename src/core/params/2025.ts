import type { ParametriParziali } from './types';

/**
 * PARAMETRI 2025 — solo i campi che servono ai calcoli sull'anno 2025
 * (Quota B sui redditi 2025, pagata nel 2026). Gli altri campi vengono dall'anno più vicino.
 */
export const PARAMETRI_2025: ParametriParziali = {
  anno: 2025,
  enpam: {
    quotaB: {
      sogliaEsenzione: {
        fonte: 'enpam.it',
        verificato: true,
        nota: 'Redditi 2025, Quota B pagata nel 2026. enpam.it agg. 3/2/2026',
        under40: 544_677,
        over40: 1_005_928,
      },
    },
  },
};
