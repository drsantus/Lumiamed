# Porting del motore in Swift

Guida per tradurre `src/core/` (TypeScript puro) in Swift ottenendo **gli stessi numeri al centesimo**.

Il riferimento è il motore TypeScript così com'è: se un risultato Swift differisce, si corregge lo Swift,
non i vettori. Le regole fiscali cambiano solo in TypeScript (vedi `AGENTS.md`), poi si rigenerano i vettori.

## Indice

1. [Vettori golden](#vettori-golden)
2. [Tipi pubblici](#tipi-pubblici)
3. [Funzioni pubbliche](#funzioni-pubbliche)
4. [Costanti e dati](#costanti-e-dati)
5. [Regole di arrotondamento](#regole-di-arrotondamento)
6. [Date e fuso orario](#date-e-fuso-orario)
7. [Altre differenze JavaScript → Swift](#altre-differenze-javascript--swift)

---

## Vettori golden

`golden/vettori.json` contiene **ogni caso** dei file `src/core/__tests__/*.test.ts` e di `scenari.ts`
(128 vettori). Gli attesi sono trascritti dalle asserzioni dei test o presi da `scenari.ts`: non sono
mai prodotti eseguendo il motore.

- Sorgente: `src/core/__tests__/vettori-casi.ts` (legge `scenari.ts`, quindi gli scenari del commercialista non sono duplicati).
- Rigenerazione: `npm run vettori`. **Non modificare il JSON a mano.**
- Verifica in TypeScript: `src/core/__tests__/vettori.test.ts` esegue tutti i vettori e fallisce se uno non torna
  o se il JSON non è allineato a `vettori-casi.ts`/`scenari.ts`.
- In Swift: un test XCTest carica lo stesso file e lo esegue con un runner equivalente (stesse regole qui sotto).

### Struttura

```jsonc
{
  "versione": 1,
  "convenzioni": { ... },
  "vettori": [
    {
      "id": "forfettario/F1",
      "origine": "fiscale.test.ts › Forfettario — ... › F1: ...",   // file › describe › it
      "nota": "...",                                                // facoltativa
      "funzione": "calcolaForfettario",
      "input": { "input": { ... }, "p": { "$parametri": 2026 } },   // argomenti per nome
      "atteso": { "redditoLordo": 3120000, ... },                   // confronto parziale
      "verifiche": [ ... ]                                          // facoltative
    },
    {
      "id": "correzioni/acconti-versati",
      "chiamate": {                                                 // forma con più chiamate
        "senza": { "funzione": "calcolaRiepilogo", "input": { ... } },
        "con":   { "funzione": "calcolaRiepilogo", "input": { ... } }
      },
      "verifiche": [ { "valore": { "$diff": [ { "$": "senza.daAccantonare" }, { "$": "con.daAccantonare" } ] }, "op": "uguale", "atteso": 300000 } ]
    }
  ]
}
```

Ogni vettore ha **o** `funzione` + `input` **o** `chiamate`, e almeno uno tra `atteso` e `verifiche`.

### Input

- Gli argomenti sono indicati per **nome del parametro** della firma TypeScript (vedi [Funzioni pubbliche](#funzioni-pubbliche)).
  Il runner li passa in ordine di firma; un argomento assente vale `undefined` (cioè il valore di default).
- `{"$parametri": 2026}` = `getParametri(2026).parametri`. Con `"campo": "irpef.scaglioni"` si prende solo quel percorso.
- Importi in centesimi interi; date `"aaaa-mm-gg"`; aliquote e percentuali come frazioni (`0.15`).

Funzioni usate dai vettori e nomi dei parametri (in ordine):

| funzione | parametri |
|---|---|
| `addizionaleComunale` | imponibile, codiceCatastale, tabelle, annoRiferimento |
| `addizionaleRegionale` | imponibile, regione, tabelle |
| `aliquotaForfettario` | anno, profilo, p |
| `attribuisciVersamenti` | spese, opt |
| `bolloDovuto` | f, p |
| `calcolaForfettario` | input, p |
| `calcolaOrdinario` | input, p |
| `calcolaRiepilogo` | input |
| `confrontaAcconti` | baseStorica, impostaStimataAnnoCorrente, p |
| `creditiAperti` | fatture, oggi, p |
| `csvFatture` | fatture, anno, p, opt |
| `csvSpese` | spese, anno |
| `detrazioneLavoroAutonomo` | redditoComplessivo, p |
| `easterSunday` | year |
| `etaAl` | dataNascita, al |
| `generaScadenziario` | opt, p |
| `getParametri` | anno |
| `impostaProgressiva` | imponibile, scaglioni |
| `liquidazioniIva` | fatture, spese, anno, p |
| `nettoIncassato` | f, p |
| `parseImporto` | raw |
| `parseInvoiceText` | text |
| `pianoAcconti` | base, p |
| `primoGiornoLavorativo` | iso |
| `proRata` | fatture, anno |
| `proiezioneAnnua` | valoreDaInizioAnno, oggi |
| `puoAggiungere` | piano, tipo, usatiNelMese, limiti |
| `puoUsare` | piano, funzione, limiti |
| `quotaA` | anno, dataNascita, p |
| `quotaB` | annoReddito, redditoProfessionale, dataNascita, p, frazioneAnno |
| `ricaviAnno` | fatture, anno, p, finoAl |
| `speseDeducibili` | spese, compensi, p, percentualeDetrazioneIva |
| `tabelleCaricate` | tabelle |

### Confronto di `atteso` (parziale)

- **Oggetto**: si controllano solo le chiavi presenti nell'atteso; le altre chiavi del risultato sono ignorate.
- **Array**: stessa lunghezza ed elementi confrontati uno a uno con le stesse regole.
- **`null`**: il valore deve essere `null` o assente (`undefined` in TS, `nil` in Swift).
- **Numeri, stringhe, booleani**: uguaglianza esatta (nessuna tolleranza: i centesimi devono coincidere).

### Verifiche

`{ "valore": Espr, "op": Operatore, "atteso": Espr, "cifre": n }`

**Percorsi** (`{"$": "percorso"}`): chiavi separate da `.` più selettori tra parentesi quadre.
Nella forma con `chiamate` il primo segmento è il nome della chiamata.

| selettore | significato |
|---|---|
| `[n]` | elemento n dell'array |
| `[*]` | tutti gli elementi; il resto del percorso si applica a ciascuno |
| `[k=v]` | primo elemento con `String(k) == v` |
| `[k~=regex]` | elementi con `k` che corrisponde alla regex; il resto del percorso si applica a ciascuno |
| `""` | il risultato intero |

**Espressioni**: un letterale JSON, un percorso, oppure

| espressione | valore |
|---|---|
| `{"$somma": [e…]}` | somma; un elemento che è un array viene sommato elemento per elemento (`null` = 0) |
| `{"$diff": [a, b]}` | a − b |
| `{"$prodotto": [e…]}` | prodotto, da sinistra a destra |
| `{"$quoziente": [a, b]}` | a ÷ b (in virgola mobile) |
| `{"$max": [e…]}` | massimo |
| `{"$abs": e}` | valore assoluto |
| `{"$lunghezza": e}` | lunghezza di array o stringa |
| `{"$righe": e}` | numero di parti di una stringa divisa su `\n` |
| `{"$parametri": anno, "campo": "…"}` | come negli input |

**Operatori**

| op | passa se |
|---|---|
| `uguale` | `valore` e `atteso` coincidono con le regole del confronto parziale |
| `maggioreDi`, `minoreDi`, `minoreOUguale` | confronto numerico |
| `vicino` | \|valore − atteso\| < 10^−cifre / 2 (come `toBeCloseTo`) |
| `contiene` / `nonContiene` | stringa: sottostringa; array: esiste un elemento uguale |
| `corrisponde` | la stringa corrisponde alla regex (sintassi JavaScript) |
| `jsonNonContiene` | la serializzazione JSON del valore non contiene la stringa |
| `ordinato` | l'array è non decrescente |

Le regex dei vettori usano solo costrutti comuni a JavaScript e ICU (`NSRegularExpression`), incluso il lookahead `(?!…)`.

---

## Tipi pubblici

Tutto ciò che `src/core/index.ts` esporta. Le interfacce TS diventano `struct` (`Codable`), le unioni di
stringhe `enum: String`, i campi `?` diventano `Optional`.

### Fondamentali — `money.ts`, `types.ts`

- `type Cents = number` — importo in centesimi interi. In Swift: `Int`.
- `type IsoDate = string` — data `"aaaa-mm-gg"`.
- `type Regime = 'forfettario' | 'ordinario'` — regime fiscale.
- `type RegioneCode = 'ABR' | … | 'VEN'` — 21 codici di regione/provincia autonoma (`TAA_TN`, `TAA_BZ`).
- `type TrattamentoIva = 'esente_art10' | 'imponibile_22' | 'forfettario_no_iva'` — trattamento IVA della prestazione.
- `type DestinatarioFattura = 'paziente' | 'struttura'` — a chi è intestata la fattura.
- `type StatoFattura = 'da_incassare' | 'incassata'` — stato di incasso.
- `type CategoriaSpesa = 'affitto_studio' | … | 'altro'` — 17 categorie, con la deducibilità nei parametri.
- `type TributoVersamento = 'imposta' | 'addizionale_regionale' | 'addizionale_comunale' | 'iva' | 'enpam_quota_a' | 'enpam_quota_b'` — tributo di un versamento.
- `interface Profilo` — dati del medico: regime, nascita, inizio attività, requisiti 5%, coefficiente, comune, regione, rate ENPAM, fatture elettroniche, `annoPrecedente`.
- `interface DatiAnnoPrecedente` — imposta "rigo differenza", addizionali, ricavi, acconti versati, reddito professionale, ritenute dell'anno precedente.
- `interface Fattura` — fattura emessa: imponibile, trattamento IVA, IVA, bollo, destinatario, ritenuta, stato, data di incasso, invio STS.
- `interface Spesa` — pagamento: data, importo IVA inclusa, IVA, categoria, deducibilità personalizzata, `riferimento` per F24/ENPAM.
- `interface RiferimentoVersamento` — `{ tributo, anno, tipo?: 'saldo' | 'acconto' }`.
- `interface Avviso` — `{ codice, livello: 'info' | 'attenzione' | 'critico', messaggio }`.

### Parametri — `params/`

- `interface Fonte` — `{ fonte, verificato, nota? }`, presente in ogni gruppo di parametri.
- `interface Scaglione` — `{ fino: Cents | null, aliquota }`; `null` = senza limite superiore.
- `interface ParametriAnno` — parametri normativi di un anno: forfettario, irpef, detrazioneLavoroAutonomo, acconti, enpam, iva, bollo, spese, scadenze.
- `interface ParametriRisolti` — `{ parametri, approssimati }`.

### Risultati e opzioni

- `interface InputForfettario` / `RisultatoForfettario` — ingresso e dettaglio del calcolo forfettario.
- `interface InputOrdinario` / `RisultatoOrdinario` — ingresso e dettaglio IRPEF, detrazione e addizionali.
- `interface RisultatoSpese` — spese pagate e deducibili, per categoria, con avvisi.
- `interface QuotaScaglione` — dettaglio di uno scaglione: da, a, aliquota, base, imposta.
- `interface DettaglioQuotaA` — totale, contributo base, maternità, importo mese per mese.
- `interface DettaglioQuotaB` — totale, reddito, soglia, basi e quote ad aliquota intera e oltre massimale.
- `interface PianoAcconti` — base, totale, prima e seconda rata, `modalita: 'nessuno' | 'unica_soluzione' | 'due_rate'`.
- `interface Proiezione` — valore annuo proiettato, frazione d'anno, affidabilità.
- `interface ConfrontoAcconti` — piano storico, piano previsionale, risparmio, avvisi.
- `interface LiquidazioneTrimestre` / `RisultatoIva` — liquidazione IVA trimestrale con pro-rata e crediti riportati.
- `interface Credito` — fattura non incassata con giorni trascorsi e importo atteso.
- `interface Esenzione` — `{ soglia, tipo: 'esclusione' | 'franchigia' }`.
- `interface AddizionaleRegionale` / `AddizionaleComunale` — righe delle tabelle delle addizionali.
- `interface TabelleAddizionali` — `{ regionali, comunali }` indicizzate per codice.
- `interface RisultatoAddizionale` — `{ importo, avvisi }`.
- `type CategoriaScadenza`, `interface Scadenza`, `ImportiScadenze`, `OpzioniScadenziario` — scadenziario e importi stimati.
- `interface VersamentoAttribuito`, `OpzioniAttribuzione`, `RisultatoAttribuzione` — attribuzione dei versamenti F24/ENPAM.
- `interface CampoLetto<T>`, `FatturaLetta` — campi letti dal testo OCR con confidenza 0-1.
- `type Piano`, `type Funzione`, `interface LimitiPiano`, `EsitoLimite` — limiti dei piani Free/Pro.
- `interface OpzioniReport` — `{ includiNomePaziente? }` per l'export CSV.
- `interface InputRiepilogo`, `StimaImposte`, `type MetodoStima`, `DettaglioAccantonamento`, `ImpegniAnnoPrecedente`, `Riepilogo` — ingresso e uscita della dashboard.

`StimaImposte.dettaglio` è `RisultatoForfettario | RisultatoOrdinario`: in Swift un `enum` con valori associati.

---

## Funzioni pubbliche

Firme TypeScript come nel sorgente. `p: ParametriAnno` è sempre l'ultimo argomento quando serve.

### `money.ts`

- `euro(value: number): Cents` — euro (anche decimali) → centesimi: `round(value × 100)`.
- `toEuro(cents: Cents): number` — centesimi → euro, solo per la visualizzazione.
- `pct(cents: Cents, rate: number): Cents` — applica un'aliquota: `round(cents × rate)`.
- `sum(values: Cents[]): Cents` — somma.
- `clampMin0(cents: Cents): Cents` — negativi a zero.
- `formatEuro(cents: Cents): string` — formato italiano `"€ 12.345,67"` (segno `-` davanti a `€`), solo aritmetica intera.

### `dates.ts`

- `parseIso(iso: IsoDate): Date` — data ISO → istante a mezzanotte UTC.
- `toIso(date: Date): IsoDate` — istante → data ISO in UTC.
- `isoYear(iso: IsoDate): number` / `isoMonth(iso: IsoDate): number` — anno e mese letti dalla stringa.
- `ymd(y: number, m: number, d: number): IsoDate` — compone la data con zeri iniziali (mese 1-12).
- `addDays(iso: IsoDate, days: number): IsoDate` — aggiunge giorni di calendario.
- `daysBetween(from: IsoDate, to: IsoDate): number` — giorni tra due date (`to − from`).
- `lastDayOfMonth(y: number, m: number): IsoDate` — ultimo giorno del mese.
- `easterSunday(year: number): IsoDate` — Pasqua (Meeus/Jones/Butcher).
- `festivita(year: number): Set<IsoDate>` — festività nazionali più Pasquetta (nessun santo patrono).
- `isWeekend(iso: IsoDate): boolean` — sabato o domenica.
- `isGiornoLavorativo(iso: IsoDate): boolean` — né weekend né festivo.
- `primoGiornoLavorativo(iso: IsoDate): IsoDate` — la data stessa o il primo giorno lavorativo successivo.
- `etaAl(dataNascita: IsoDate, al: IsoDate): number` — anni compiuti alla data.

### `params/`

- `getParametri(anno: number): ParametriRisolti` — parametri dell'anno; se mancano usa l'anno più vicino (a parità di distanza il più vecchio) con `anno` sostituito e `approssimati: true`.
- `anniDisponibili(): number[]` — anni con parametri.

### `movimenti.ts`

- `bolloDovuto(f: Pick<Fattura, 'imponibile' | 'trattamentoIva'>, p): boolean` — bollo da 2 € su fatture senza IVA con imponibile > 77,47 €.
- `ivaFattura(f: Fattura, p): Cents` — IVA della fattura (0 se non imponibile; altrimenti `f.iva` o il 22% dell'imponibile).
- `totaleFattura(f: Fattura, p): Cents` — imponibile + IVA + bollo addebitato.
- `nettoIncassato(f: Fattura, p): Cents` — totale meno ritenuta.
- `fattureIncassateAnno(fatture: Fattura[], anno: number): Fattura[]` — fatture incassate con data di incasso nell'anno.
- `ricaviAnno(fatture: Fattura[], anno: number, p, finoAl?: IsoDate): Cents` — ricavi per cassa (bollo incluso solo se il parametro lo prevede).
- `ritenuteAnno(fatture: Fattura[], anno: number): Cents` — ritenute sulle fatture incassate nell'anno.
- `speseAnno(spese: Spesa[], anno: number, finoAl?: IsoDate): Spesa[]` — spese pagate nell'anno.
- `contributiEnpamVersati(spese: Spesa[], anno: number, finoAl?: IsoDate): Cents` — contributi ENPAM pagati nell'anno.
- `creditiAperti(fatture: Fattura[], oggi: IsoDate, p): Credito[]` — fatture da incassare, dalla più vecchia.

### `forfettario.ts`

- `aliquotaForfettario(anno: number, profilo: Pick<Profilo, 'annoInizioAttivita' | 'requisitiStartup5' | 'coefficienteRedditivita'>, p): number` — 5% nei primi 5 anni con i requisiti, altrimenti 15%.
- `calcolaForfettario(input: InputForfettario, p): RisultatoForfettario` — reddito = ricavi × coefficiente, meno contributi (fino al reddito), per l'aliquota; avvisi sui limiti 85k/100k.

### `ordinario.ts` e `scaglioni.ts`

- `impostaProgressiva(imponibile: Cents, scaglioni: Scaglione[]): { totale: Cents; dettaglio: QuotaScaglione[] }` — imposta per scaglioni, arrotondata per scaglione.
- `speseDeducibili(spese: Spesa[], compensi: Cents, p, percentualeDetrazioneIva = 0): RisultatoSpese` — quota deducibile per categoria al netto dell'IVA detratta, con i limiti ristoranti (2% dei compensi) e formazione (10.000 €).
- `detrazioneLavoroAutonomo(redditoComplessivo: Cents, p): Cents` — detrazione dell'art. 13 c. 5 TUIR.
- `calcolaOrdinario(input: InputOrdinario, p): RisultatoOrdinario` — IRPEF lorda, detrazione, netta, "rigo differenza" e addizionali (nulle se l'IRPEF netta è 0).

### `enpam.ts`

- `quotaA(anno: number, dataNascita: IsoDate, p): DettaglioQuotaA` — Quota A mese per mese secondo l'età a fine mese precedente, più maternità.
- `quotaB(annoReddito: number, redditoProfessionale: Cents, dataNascita: IsoDate, p, frazioneAnno = 1): DettaglioQuotaB` — Quota B sul reddito oltre la soglia, 1% oltre il massimale; soglia e massimale × `frazioneAnno`.

### `iva.ts`

- `trimestreDi(iso: string): 1 | 2 | 3 | 4` — trimestre della data.
- `proRata(fatture: Fattura[], anno: number): number` — percentuale di detrazione arrotondata al punto percentuale superiore (0 senza imponibili, 1 senza esenti).
- `liquidazioniIva(fatture: Fattura[], spese: Spesa[], anno: number, p): RisultatoIva` — liquidazioni trimestrali con l'1% di interessi e il credito riportato.

### `acconti.ts`

- `pianoAcconti(base: Cents, p): PianoAcconti` — nessun acconto sotto 51,65 €, unica rata sotto 257,52 €, altrimenti due rate (50% + resto).
- `accontoAddizionaleComunale(addizionaleAnnoPrecedente: Cents, p): Cents` — 30% dell'addizionale comunale dell'anno precedente.
- `proiezioneAnnua(valoreDaInizioAnno: Cents, oggi: IsoDate): Proiezione` — proiezione lineare a fine anno; affidabile dal 60° giorno.
- `confrontaAcconti(baseStorica: Cents, impostaStimataAnnoCorrente: Cents, p): ConfrontoAcconti` — metodo storico contro previsionale, con avvisi.

### `addizionali/`

- `addizionaleRegionale(imponibile: Cents, regione: RegioneCode | undefined, tabelle = TABELLE_PRECARICATE): RisultatoAddizionale` — scaglioni, aliquota agevolata, esenzione e detrazioni; 1,23% con avviso se la regione manca.
- `addizionaleComunale(imponibile: Cents, codiceCatastale: string | undefined, tabelle = TABELLE_PRECARICATE, annoRiferimento?: number): RisultatoAddizionale` — aliquota unica o scaglioni con esenzione; codice cercato in maiuscolo; 0 con avviso se manca.
- `cercaComune(testo: string, tabelle = TABELLE_PRECARICATE): AddizionaleComunale[]` — comuni il cui nome inizia con il testo (minimo 2 caratteri, massimo 20 risultati).
- `tabelleCaricate(tabelle = TABELLE_PRECARICATE): { regioni: number; comuni: number }` — quante voci ci sono nelle tabelle.

### `scadenziario.ts`

- `frazioneQuotaBNellAnno(rate: 1 | 2 | 5 | 9): number` — frazione della Quota B dell'anno scorso che scade entro dicembre.
- `quotaADovutaEntro(rate: 1 | 4 | 8, totale: Cents, mese: number): Cents` — Quota A scaduta entro il mese, rata del mese compresa.
- `rataQuotaBNelMese(rate: 1 | 2 | 5 | 9, mese: number): boolean` — c'è una rata di Quota B nel mese.
- `generaScadenziario(opt: OpzioniScadenziario, p): Scadenza[]` — scadenze dell'anno spostate al primo giorno lavorativo, ordinate per data e id, con importi stimati divisi per rata.
- `scadenzeImminenti(scadenze: Scadenza[], oggi: IsoDate, entro: IsoDate): Scadenza[]` — scadenze tra le due date, estremi inclusi.

### `versamenti.ts`

- `attribuisciVersamenti(spese: Spesa[], opt: OpzioniAttribuzione): RisultatoAttribuzione` — attribuisce i versamenti F24/ENPAM dell'anno a tributo e anno; senza riferimento usa il calendario (regole nel commento della funzione).
- `totaleVersato(versamenti: VersamentoAttribuito[], tributi: TributoVersamento[], annoRiferimento: number, tipo?: 'saldo' | 'acconto'): Cents` — somma per tributo, anno ed eventualmente tipo.

### `riepilogo.ts`

- `saldoAddizionaliAnnoPrecedente(prec: DatiAnnoPrecedente, p): Cents` — regionale intera più comunale meno l'acconto versato (o il 30% stimato).
- `aliquotaEffettivaAnnoPrecedente(profilo: Profilo, anno: number, p): number | undefined` — imposte dell'anno scorso ÷ ricavi, riproporzionata se cambia l'aliquota forfettaria.
- `calcolaRiepilogo(input: InputRiepilogo): Riepilogo` — dashboard: ricavi, stime, "da accantonare", impegni dell'anno scorso, guadagno netto, acconti, crediti, scadenze, avvisi.

### `ocr/parseInvoiceText.ts`

- `parseImporto(raw: string): Cents | undefined` — importo in formato italiano o inglese → centesimi.
- `parseInvoiceText(text: string): FatturaLetta` — propone numero, data, totale, imponibile, bollo, trattamento IVA, ritenuta e prestazione dal testo OCR; non estrae il codice fiscale.

### `piani.ts`

- `puoUsare(piano: Piano, funzione: Funzione, limiti = LIMITI): boolean` — la funzione è inclusa nel piano.
- `puoAggiungere(piano: Piano, tipo: 'fattura' | 'spesa', usatiNelMese: number, limiti = LIMITI): EsitoLimite` — limite mensile di fatture o spese.

### `report.ts`

- `csvFatture(fatture: Fattura[], anno: number, p, opt: OpzioniReport = {}): string` — CSV con `;` e decimali con la virgola; nome paziente solo su richiesta.
- `csvSpese(spese: Spesa[], anno: number): string` — CSV delle spese dell'anno.

---

## Costanti e dati

- `LIMITI: Record<Piano, LimitiPiano>` — limiti Free/Pro (valori ancora da decidere).
- `ALIQUOTA_REGIONALE_BASE = 0.0123` — usata se la regione non è in tabella.
- `src/core/addizionali/data/regionali.json` e `comunali.json` — tabelle MEF precaricate: vanno incluse **identiche** nel bundle Swift (i vettori `tabelle/*` le usano).
- `src/core/params/2026.ts` — parametri 2026: vanno trascritti con gli stessi valori (stessi letterali decimali, ad esempio `0.195`, così da ottenere gli stessi `Double`).

---

## Regole di arrotondamento

### Rappresentazione

- In TypeScript gli importi sono `number` (double IEEE 754) con valori interi. Somme e differenze di centesimi sono esatte.
- In Swift: `Cents = Int`. Ogni moltiplicazione o divisione per un'aliquota si fa in `Double` e si riporta a `Int` con l'arrotondamento JS qui sotto.
- **Non usare `Decimal`**: il motore lavora in `Double`, e con `Decimal` alcuni casi vicini a ,5 escono diversi.
  Esempio: `euro(1.005)` vale 100 centesimi, perché in `Double` `1.005 * 100` fa 100,49999999999999; con `Decimal` verrebbe 101.
- Mantenere **lo stesso ordine delle operazioni** del sorgente: in virgola mobile `(a × b) / c` può dare un risultato diverso da `a × (b / c)`.

### `Math.round` ≠ `rounded()` di Swift

`Math.round(x)` arrotonda le metà verso **+∞**: `Math.round(2.5) = 3`, `Math.round(-2.5) = -2`, `Math.round(-0.5) = -0`.
`x.rounded()` di Swift arrotonda le metà lontano da zero (`-2.5 → -3`), quindi è diverso sui negativi. Usare:

```swift
/// Equivalente esatto di Math.round di JavaScript.
@inline(__always) func jsRound(_ x: Double) -> Int {
    let f = x.rounded(.down)
    return Int(x - f >= 0.5 ? f + 1 : f)
}
```

(Non usare `floor(x + 0.5)`: per `x = 0.49999999999999994` dà 1, mentre `Math.round` dà 0.)

### Dove si arrotonda

| punto | formula |
|---|---|
| `euro(v)` | `round(v × 100)` |
| `pct(c, r)` | `round(c × r)`, usato per: reddito e imposta forfettari, 90% del limite, IVA della fattura, IVA detraibile, interessi IVA, acconti e prima rata, acconto e saldo dell'addizionale comunale (30%), quote ENPAM B, limite ristoranti, addizionali ad aliquota unica o agevolata, imposte maturate col metodo `anno_precedente` |
| `speseDeducibili` | per **ogni spesa**: `costo = importo − pct(iva, %detrazione)`, poi `pct(costo, deducibilità)`; poi si somma per categoria e si applicano i limiti |
| `impostaProgressiva` | `round(base × aliquota)` **per scaglione**, poi somma |
| `detrazioneLavoroAutonomo` | `round(base2 + (variabile2 × (soglia2 − r)) / (soglia2 − soglia1))` e `round((base3 × (soglia3 − r)) / (soglia3 − soglia2))` |
| `quotaA` | `contributoBase = round(Σ importi annui dei 12 mesi / 12)`; il dettaglio mensile è `round(annuo / 12)` (solo informativo, la somma dei mesi non è il totale) |
| `quotaB` | `soglia = round(sogliaAnnua × f)`, `massimale = round(massimale × f)`, poi `pct` sulle due basi |
| `proiezioneAnnua` | `round(valore / frazioneAnno)`, con `frazioneAnno = min(1, giorniTrascorsi / giorniAnno)` non arrotondata |
| `calcolaRiepilogo` | spese, IVA e ritenute proiettate: `round(v / f)`; Quota B dell'anno scorso nell'anno: `round(qb × frazioneQuotaBNellAnno)`; imposte maturate: `round(imposteProiettate × f)`; Quota A maturata: `round(totale × f)` |
| `proRata` | punti = arrotondamento per eccesso intero di `imponibili × 100 / (imponibili + esenti)`; risultato `punti / 100` in `Double` (es. `0.2`) |
| `generaScadenziario` (rate) | `base = floor(totale / parti)` per ogni rata, l'ultima prende `totale − base × (parti − 1)`: la somma resta esatta |
| `pianoAcconti` | `secondaRata = totale − primaRata` (nessun centesimo perso) |
| `parseInvoiceText` | imponibile ricavato dal totale con IVA: `round(valore / 1.22)` |
| `csvFatture`/`csvSpese` | `(c / 100).toFixed(2)` con la virgola: in Swift `String(format: "%.2f", Double(c) / 100)` con la virgola come separatore |

Altri valori **non arrotondati**: `aliquotaEffettivaAnnoPrecedente` (rapporto `Double`), `percentualeLimiteForfettario`,
il confronto `impostaStimata > baseStorica × 1.2` in `confrontaAcconti`.

Divisioni intere: `Math.floor(a / b)` in JS arrotonda verso −∞; la `/` tra `Int` in Swift tronca verso zero.
Sono uguali solo con operandi non negativi (oggi sempre così nello scadenziario).

**`proRata` va calcolato in aritmetica intera**: in `Double`, `(7 / 100) × 100` vale 7,000000000000001 e `ceil` salirebbe
a 8. Il motore calcola i punti percentuali come arrotondamento per eccesso **intero** di `imponibili × 100 / (imponibili + esenti)`;
in Swift con `Int`: `(imponibili * 100 + totale - 1) / totale` (operandi positivi). Il vettore `iva/pro-rata-esatto` lo verifica.

---

## Date e fuso orario

- Le date sono **stringhe `aaaa-mm-gg`** a lunghezza fissa (anno di 4 cifre). Il motore le confronta come stringhe
  (`<=`, `>=`): in Swift il confronto `<` tra `String` ASCII di uguale lunghezza dà lo stesso ordine.
- Tutti i calcoli di calendario sono in **UTC** (`Date.UTC`, `getUTC*`, `toISOString`): niente fuso locale né ora legale,
  ogni giorno dura 86.400.000 ms. `daysBetween` arrotonda comunque con `Math.round`.
- In Swift fare l'aritmetica sulle date senza fuso: `Calendar(identifier: .gregorian)` con `timeZone = TimeZone(identifier: "UTC")`,
  oppure algoritmi interi su giorno/mese/anno (ad esempio *days from civil*). **Mai `Calendar.current`**: l'utente può avere
  un calendario non gregoriano (buddista, giapponese) o un altro fuso. Per leggere e scrivere stringhe usare un `DateFormatter`
  con `locale = en_US_POSIX`, `timeZone = UTC` e `dateFormat = "yyyy-MM-dd"`, oppure comporle a mano come fa `ymd`.
- **Il motore non legge mai l'orologio**: "oggi" arriva sempre come parametro (`oggi` di `calcolaRiepilogo`, `creditiAperti`,
  `proiezioneAnnua`, `attribuisciVersamenti`). Chi chiama deve passare la data **civile italiana**: in Swift
  `Calendar(identifier: .gregorian)` con `timeZone = TimeZone(identifier: "Europe/Rome")` applicato a `Date()`.
  Non usare la data UTC: tra mezzanotte e l'1-2 di notte in Italia è ancora il giorno prima (il 1° gennaio diventerebbe il 31 dicembre dell'anno precedente).
- Giorno della settimana: JS `getUTCDay()` va da 0 = domenica a 6 = sabato; il `weekday` di `Calendar` va da 1 = domenica a 7 = sabato.
- Mesi: `ymd`, `lastDayOfMonth` e `RATE_QUOTA_*` usano i mesi 1-12; in JS `Date.UTC` vuole 0-11 (il sorgente fa `m - 1`).
  `lastDayOfMonth(y, m)` usa `Date.UTC(y, m, 0)`, cioè "giorno 0 del mese successivo".
- `isoYear` e `isoMonth` leggono le cifre dalla stringa (`slice`), senza passare da un `Date`.
- Età (`etaAl`): differenza degli anni, meno 1 se alla data non si è ancora arrivati al giorno e mese di nascita.
  Quota A: età alla fine del mese precedente (per gennaio il 31/12 dell'anno prima). Quota B: età al 31/12 dell'anno del reddito; con età < 40 si usa la soglia under 40.
- Festività: 1/1, 6/1, 25/4, 1/5, 2/6, 15/8, 1/11, 8/12, 25/12, 26/12 e Pasquetta (Pasqua + 1). Nessun santo patrono.
  `primoGiornoLavorativo` avanza di un giorno finché non trova un giorno lavorativo.
- `proiezioneAnnua`: `giorniAnno` = 365 o 366; `trascorsi` = giorni dal 1° gennaio a oggi **+ 1** (il 1° gennaio vale 1).
- Scadenze: si usano le date di `p.scadenze` solo se `p.scadenze.saldoPrimoAccontoIsa` è dell'anno richiesto; altrimenti le date standard (30/6, 30/11, 31/10, 31/1, 31/7).
- `parseInvoiceText`: accetta `g/m/a`, `g.m.a`, `g-m-a`; gli anni a 2 cifre diventano 20xx; date fuori 2000-2100 sono scartate (giorni 1-31 senza controllare il mese).

---

## Altre differenze JavaScript → Swift

- **Ordinamenti con `localeCompare`** (`generaScadenziario` a parità di data, `attribuisciVersamenti` a parità di data,
  `csvFatture`, `csvSpese`): usano la collazione ICU, dove `"a" < "B"`; in Swift `<` confronta i codici Unicode (`"B" < "a"`).
  Sulle date ISO e sugli id attuali dello scadenziario (minuscole, cifre, trattini, con la maiuscola nella stessa posizione)
  l'ordine coincide. Per gli id generati dall'app (`Spesa.id`) conviene usare solo minuscole e cifre, così `<` basta.
  Gli ordinamenti JS sono stabili, mentre `sort` di Swift non lo garantisce. Per lo scadenziario e i versamenti non conta
  (la chiave data + id è univoca). Per `csvFatture` e `csvSpese`, che ordinano solo per data, a parità di data va mantenuto
  l'ordine di ingresso: ordinare per (data, indice originale).
- **`undefined` e `null`**: entrambi diventano `nil`. `x ?? y` di TS corrisponde a `x ?? y` di Swift.
- **Ordine delle chiavi**: `perCategoria` è un oggetto la cui somma non dipende dall'ordine; nessun risultato dipende dall'ordine delle chiavi.
- **Regex di `parseInvoiceText`**: sintassi JavaScript. In JS `\d` e `\b` sono solo ASCII, mentre in ICU (`NSRegularExpression`)
  sono Unicode: con Swift `Regex` usare `.asciiOnlyDigits()` e `.asciiOnlyWordCharacters()`. `.replace(',', '.')` con una
  stringa sostituisce **solo la prima** occorrenza, come `.replace(/EUR/i, '')`.
- **Lunghezza delle stringhe**: `slice(0, 80)` conta unità UTF-16; `prefix(80)` di Swift conta caratteri.
  Per avere lo stesso risultato usare `String(s.utf16.prefix(80))` (o accettare la differenza, che riguarda solo emoji e simili).
- **`trim()`** toglie anche spazi Unicode come lo spazio non separabile: in Swift `trimmingCharacters(in: .whitespacesAndNewlines)`.
- **`Number(s)`** su stringhe numeriche: in Swift `Double(s)`. Differiscono su stringhe vuote o con spazi, che `parseImporto` non produce
  (prima toglie gli spazi e controlla che ci sia almeno una cifra).
- **Avvisi**: i vettori controllano i `codice` degli avvisi, non il testo dei `messaggio`. I messaggi vanno comunque copiati uguali.
