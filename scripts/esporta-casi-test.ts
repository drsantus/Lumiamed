/**
 * Esporta casi di test e parametri fiscali in JSON (docs/casi-test.json).
 * Da lì `python scripts/genera_excel_commercialista.py` crea il file Excel per il commercialista.
 *
 * Uso: npm run casi-test
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { formatEuro } from '../src/core/money';
import { getParametri } from '../src/core/params';
import {
  SCENARI_ACCONTI, SCENARI_FORFETTARIO, SCENARI_ORDINARIO, SCENARI_QUOTA_A, SCENARI_QUOTA_B,
} from '../src/core/__tests__/scenari';

const e = (c: number) => c / 100;
const pctTxt = (x: number) => `${(x * 100).toLocaleString('it-IT', { maximumFractionDigits: 2 })}%`;
const eurTxt = (c: number) => `${formatEuro(c).replace('€ ', '')} €`;

interface Riga { id: string; area: string; descrizione: string; input: string; voce: string; valore: number; formato: 'euro' | 'percentuale' | 'testo'; testo?: string }
const righe: Riga[] = [];

for (const s of SCENARI_FORFETTARIO) {
  const input = `Anno ${s.input.anno}; inizio attività ${s.input.annoInizioAttivita}; requisiti 5%: ${s.input.requisitiStartup5 ? 'sì' : 'no'}; ricavi incassati ${eurTxt(s.input.ricavi)}; ENPAM versato nell'anno ${eurTxt(s.input.contributiVersati)}`;
  const base = { id: s.id, area: 'Forfettario', descrizione: s.descrizione, input };
  righe.push({ ...base, voce: 'Reddito lordo (ricavi × 78%)', valore: e(s.atteso.redditoLordo), formato: 'euro' });
  righe.push({ ...base, voce: 'Imponibile (dopo contributi)', valore: e(s.atteso.imponibile), formato: 'euro' });
  righe.push({ ...base, voce: 'Aliquota imposta sostitutiva', valore: s.atteso.aliquota, formato: 'percentuale' });
  righe.push({ ...base, voce: 'Imposta sostitutiva', valore: e(s.atteso.impostaSostitutiva), formato: 'euro' });
}

for (const s of SCENARI_ORDINARIO) {
  const spese = s.input.spese.map((x) => `${x.categoria} ${eurTxt(x.importo)}`).join(', ');
  const input = `Compensi ${eurTxt(s.input.compensi)}; spese: ${spese}; ENPAM versato ${eurTxt(s.input.contributiVersati)}; ritenute subite ${eurTxt(s.input.ritenute)}. Addizionali calcolate con tabelle DI PROVA: regionale 1,73%/2,73%/2,93%/3,33% (scaglioni 15k/28k/50k), comunale 0,8% con esenzione fino a 10.000 €.`;
  const base = { id: s.id, area: 'Ordinario', descrizione: s.descrizione, input };
  const a = s.atteso;
  righe.push({ ...base, voce: 'Spese deducibili', valore: e(a.speseDeducibili), formato: 'euro' });
  righe.push({ ...base, voce: 'Reddito professionale', valore: e(a.redditoProfessionale), formato: 'euro' });
  righe.push({ ...base, voce: 'Reddito imponibile IRPEF', valore: e(a.imponibile), formato: 'euro' });
  righe.push({ ...base, voce: 'IRPEF lorda', valore: e(a.impostaLorda), formato: 'euro' });
  righe.push({ ...base, voce: 'Detrazione lavoro autonomo (art. 13 c. 5 TUIR)', valore: e(a.detrazioneLavoroAutonomo), formato: 'euro' });
  righe.push({ ...base, voce: 'IRPEF netta', valore: e(a.impostaNetta), formato: 'euro' });
  righe.push({ ...base, voce: 'Addizionale regionale (tabella di prova)', valore: e(a.addizionaleRegionaleProva), formato: 'euro' });
  righe.push({ ...base, voce: 'Addizionale comunale (tabella di prova)', valore: e(a.addizionaleComunaleProva), formato: 'euro' });
}

for (const s of SCENARI_QUOTA_A) {
  righe.push({ id: s.id, area: 'ENPAM Quota A', descrizione: s.descrizione, input: `Anno ${s.input.anno}; nato il ${s.input.dataNascita}`, voce: 'Quota A totale (con maternità)', valore: e(s.atteso.totale), formato: 'euro' });
}
for (const s of SCENARI_QUOTA_B) {
  const base = { id: s.id, area: 'ENPAM Quota B', descrizione: s.descrizione, input: `Redditi ${s.input.annoReddito}; nato il ${s.input.dataNascita}; reddito libero-professionale ${eurTxt(s.input.redditoProfessionale)}` };
  righe.push({ ...base, voce: 'Soglia esente (coperta da Quota A)', valore: e(s.atteso.soglia), formato: 'euro' });
  righe.push({ ...base, voce: 'Quota B dovuta', valore: e(s.atteso.totale), formato: 'euro' });
}
for (const s of SCENARI_ACCONTI) {
  const base = { id: s.id, area: 'Acconti', descrizione: s.descrizione, input: `Imposta anno precedente (rigo differenza) ${eurTxt(s.input.base)}` };
  righe.push({ ...base, voce: 'Modalità', valore: 0, formato: 'testo', testo: s.atteso.modalita.replace('_', ' ') });
  righe.push({ ...base, voce: '1° acconto (giugno/luglio)', valore: e(s.atteso.primaRata), formato: 'euro' });
  righe.push({ ...base, voce: '2° acconto (novembre)', valore: e(s.atteso.secondaRata), formato: 'euro' });
}

const p = getParametri(2026).parametri;
const parametri: { gruppo: string; voce: string; valore: string; fonte: string; nota?: string }[] = [];
const g = (gruppo: string, fonte: { fonte: string; nota?: string }, voci: [string, string][]) =>
  voci.forEach(([voce, valore], i) => parametri.push({ gruppo, voce, valore, fonte: fonte.fonte, nota: i === 0 ? fonte.nota : undefined }));

g('Forfettario', p.forfettario, [
  ['Limite ricavi', eurTxt(p.forfettario.limiteRicavi)],
  ['Uscita immediata oltre', eurTxt(p.forfettario.limiteUscitaImmediata)],
  ['Coefficiente di redditività (ATECO 86.2x)', pctTxt(p.forfettario.coefficienteDefault)],
  ['Aliquota startup (primi 5 anni)', pctTxt(p.forfettario.aliquotaStartup)],
  ['Aliquota ordinaria', pctTxt(p.forfettario.aliquotaOrdinaria)],
]);
g('IRPEF 2026', p.irpef, p.irpef.scaglioni.map((s, i, arr) => [
  `Scaglione ${i + 1}: ${i === 0 ? '0' : eurTxt(arr[i - 1].fino as number)} – ${s.fino === null ? 'oltre' : eurTxt(s.fino)}`, pctTxt(s.aliquota),
]));
const d = p.detrazioneLavoroAutonomo;
g('Detrazione lavoro autonomo', d, [
  [`Fino a ${eurTxt(d.soglia1)}`, eurTxt(d.importo1)],
  [`Da ${eurTxt(d.soglia1)} a ${eurTxt(d.soglia2)}`, `${eurTxt(d.base2)} + ${eurTxt(d.variabile2)} × (28.000 − reddito) / 22.500`],
  [`Da ${eurTxt(d.soglia2)} a ${eurTxt(d.soglia3)}`, `${eurTxt(d.base3)} × (50.000 − reddito) / 22.000`],
]);
g('Acconti', p.acconti, [
  ['Nessun acconto sotto', eurTxt(p.acconti.sogliaNessunAcconto)],
  ['Unica soluzione (novembre) sotto', eurTxt(p.acconti.sogliaUnicaSoluzione)],
  ['Percentuale acconto', pctTxt(p.acconti.percentuale)],
  ['Prima rata soggetti ISA/forfettari', pctTxt(p.acconti.primaRataIsa)],
  ['Acconto addizionale comunale', pctTxt(p.acconti.accontoAddizionaleComunale)],
]);
g('ENPAM', p.enpam, [
  ...p.enpam.quotaA.fasce.map((f, i, arr): [string, string] => [
    `Quota A ${i === 0 ? 'fino a 30 anni' : f.finoEta === null ? `da ${(arr[i - 1].finoEta as number) + 1} anni` : `${(arr[i - 1].finoEta as number) + 1}-${f.finoEta + 1} anni`}`,
    eurTxt(f.importoAnnuo),
  ]),
  ['Contributo maternità', eurTxt(p.enpam.quotaA.contributoMaternita)],
  ['Quota B aliquota intera', pctTxt(p.enpam.quotaB.aliquotaIntera)],
  ['Quota B massimale', eurTxt(p.enpam.quotaB.massimale)],
  ['Quota B oltre massimale', pctTxt(p.enpam.quotaB.aliquotaOltreMassimale)],
  ['Soglia esente under 40', eurTxt(p.enpam.quotaB.sogliaUnder40)],
  ['Soglia esente over 40', eurTxt(p.enpam.quotaB.sogliaOver40)],
]);
g('IVA e bollo', p.bollo, [
  ['Bollo: soglia', eurTxt(p.bollo.soglia)],
  ['Bollo: importo', eurTxt(p.bollo.importo)],
  ['Bollo riaddebitato concorre al reddito', p.bollo.addebitatoConcorreAlReddito ? 'sì' : 'no'],
  ['IVA aliquota prestazioni non sanitarie', pctTxt(p.iva.aliquotaOrdinaria)],
  ['Interessi liquidazione trimestrale', pctTxt(p.iva.interessiTrimestrali)],
]);
g('Spese (ordinario)', p.spese, Object.entries(p.spese.deducibilita).map(([k, v]) => [`Deducibilità ${k}`, pctTxt(v)]));
g('Scadenze 2026', p.scadenze, [
  ['Saldo e 1° acconto ISA/forfettari', p.scadenze.saldoPrimoAccontoIsa],
  ['2° acconto', p.scadenze.secondoAcconto],
  ['Dichiarazione dei redditi', p.scadenze.dichiarazioneRedditi],
  ['Invio Sistema TS', p.scadenze.invioSTS],
  ['Modello D ENPAM', p.scadenze.modelloD],
]);

const out = path.resolve(__dirname, '..', 'docs', 'casi-test.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ generato: new Date().toISOString(), righe, parametri }, null, 2));
console.log(`Scritto ${out}: ${righe.length} righe di verifica, ${parametri.length} parametri`);
