/**
 * Limiti dei piani Free / Pro. I VALORI SONO ANCORA DA DECIDERE:
 * modificare solo questo oggetto. `null` = illimitato.
 */
export type Piano = 'free' | 'pro';

export type Funzione =
  | 'stime_fiscali'
  | 'scadenziario'
  | 'notifiche_scadenze'
  | 'report_pdf'
  | 'export_csv'
  | 'lettura_foto'
  | 'confronto_acconti';

export interface LimitiPiano {
  maxFattureMese: number | null;
  maxSpeseMese: number | null;
  funzioni: Record<Funzione, boolean>;
}

export const LIMITI: Record<Piano, LimitiPiano> = {
  free: {
    maxFattureMese: 30, // DA DECIDERE
    maxSpeseMese: 30, // DA DECIDERE
    funzioni: {
      stime_fiscali: true,
      scadenziario: true,
      notifiche_scadenze: false,
      report_pdf: false,
      export_csv: false,
      lettura_foto: false,
      confronto_acconti: false,
    },
  },
  pro: {
    maxFattureMese: null,
    maxSpeseMese: null,
    funzioni: {
      stime_fiscali: true,
      scadenziario: true,
      notifiche_scadenze: true,
      report_pdf: true,
      export_csv: true,
      lettura_foto: true,
      confronto_acconti: true,
    },
  },
};

export const puoUsare = (piano: Piano, funzione: Funzione, limiti = LIMITI): boolean => limiti[piano].funzioni[funzione];

export interface EsitoLimite {
  consentito: boolean;
  usati: number;
  massimo: number | null;
}

export function puoAggiungere(
  piano: Piano,
  tipo: 'fattura' | 'spesa',
  usatiNelMese: number,
  limiti = LIMITI,
): EsitoLimite {
  const massimo = tipo === 'fattura' ? limiti[piano].maxFattureMese : limiti[piano].maxSpeseMese;
  return { consentito: massimo === null || usatiNelMese < massimo, usati: usatiNelMese, massimo };
}
