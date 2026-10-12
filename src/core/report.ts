import { isoYear } from './dates';
import { ivaFattura, totaleFattura } from './movimenti';
import type { Cents } from './money';
import type { ParametriAnno } from './params';
import type { Fattura, Spesa } from './types';

/**
 * Dati per l'export destinato al commercialista (CSV oggi, PDF nell'app).
 * Formato italiano: separatore ";" e decimali con la virgola (si apre bene in Excel).
 */

const eur = (c: Cents | undefined): string => ((c ?? 0) / 100).toFixed(2).replace('.', ',');
const cella = (v: string): string => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const riga = (valori: string[]): string => valori.map(cella).join(';');

export interface OpzioniReport {
  /** Includere il nome del paziente (default false: dato sanitario). */
  includiNomePaziente?: boolean;
}

export function csvFatture(fatture: Fattura[], anno: number, p: ParametriAnno, opt: OpzioniReport = {}): string {
  const header = ['Numero', 'Data fattura', 'Destinatario', 'Prestazione', 'Trattamento IVA', 'Imponibile', 'IVA', 'Bollo', 'Totale', 'Ritenuta', 'Stato', 'Data incasso', 'Inviata STS'];
  if (opt.includiNomePaziente) header.splice(3, 0, 'Paziente');
  const righe = fatture
    .filter((f) => isoYear(f.dataFattura) === anno || (f.dataIncasso && isoYear(f.dataIncasso) === anno))
    .sort((a, b) => a.dataFattura.localeCompare(b.dataFattura))
    .map((f) => {
      const r = [
        f.numero, f.dataFattura, f.destinatario, f.tipoPrestazione ?? '', f.trattamentoIva,
        eur(f.imponibile), eur(ivaFattura(f, p)), f.bolloAddebitato ? eur(p.bollo.importo) : '0,00',
        eur(totaleFattura(f, p)), eur(f.ritenutaAcconto), f.stato, f.dataIncasso ?? '', f.inviataSTS ? 'sì' : 'no',
      ];
      if (opt.includiNomePaziente) r.splice(3, 0, f.nomePaziente ?? '');
      return riga(r);
    });
  return [riga(header), ...righe].join('\n');
}

export function csvSpese(spese: Spesa[], anno: number): string {
  const header = ['Data', 'Categoria', 'Descrizione', 'Importo', 'di cui IVA'];
  const righe = spese
    .filter((s) => isoYear(s.data) === anno)
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((s) => riga([s.data, s.categoria, s.descrizione ?? '', eur(s.importo), eur(s.iva)]));
  return [riga(header), ...righe].join('\n');
}
