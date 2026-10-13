# Porting del motore in Swift

Guida per tradurre `src/core/` (TypeScript puro) in Swift ottenendo **gli stessi numeri al centesimo**.

Il riferimento è il motore TypeScript così com'è: se un risultato Swift differisce, si corregge lo Swift,
non i vettori. Le regole fiscali cambiano solo in TypeScript (vedi `AGENTS.md`), poi si rigenerano i file golden.

Versione del motore: `VERSIONE_MOTORE` in `src/core/versione.ts` (semver), riportata in tutti i file golden.

## Indice

1. [File golden](#file-golden)
2. [Vettori golden](#vettori-golden)
3. [Tipi pubblici](#tipi-pubblici)
4. [Funzioni pubbliche](#funzioni-pubbliche)
5. [Costanti e dati](#costanti-e-dati)
6. [Regole di arrotondamento](#regole-di-arrotondamento)
7. [Date e fuso orario](#date-e-fuso-orario)
8. [Altre differenze JavaScript → Swift](#altre-differenze-javascript--swift)

---

## File golden

Tutti in `golden/`, generati con `npm run vettori` (**non modificarli a mano**). Hanno l'attributo git `-text`
(`.gitattributes`): i byte sono identici su ogni sistema.

| file | contenuto | uso in Swift |
|---|---|---|
| `vettori.json` | casi di test in forma neutra + istantanee degli scenari | test XCTest che esegue ogni vettore sul motore Swift |
| `parametri.json` | per il 2025, 2026 e 2027: `getParametri(anno)` (`{ parametri, approssimati }`), più i campi propri del 2025 parziale | confronto con i parametri trascritti in Swift |
| `checksum.json` | SHA-256 dei file di dati del motore (`comunali.json`, `regionali.json`) | il bundle Swift deve contenere i file identici: calcolare lo SHA-256 (CryptoKit) e confrontarlo |

`vettori.test.ts` controlla in TypeScript che i tre file siano allineati al motore e ai casi.
L'intestazione di `vettori.json` e degli altri due file contiene `versioneMotore` e `generatoIl` (data e ora di
generazione, non confrontata).

---

## Vettori golden

`golden/vettori.json` contiene **ogni caso** dei file `src/core/__tests__/*.test.ts` e di `scenari.ts`:
1.162 vettori, di cui 885 per la ricerca dei comuni senza delibera e 19 istantanee.

- Sorgente: `src/core/__tests__/vettori-casi.ts` e `vettori-casi-bc.ts` (leggono `scenari.ts`, quindi gli scenari del commercialista non sono duplicati).
- Esecutore TypeScript: `src/core/__tests__/vettori-runner.ts`. Il runner Swift deve seguire le stesse regole.
- **Regola sugli attesi**: gli attesi sono trascritti dai test o presi da `scenari.ts`, mai calcolati con il motore,
  e sono **sempre valori letterali** (numeri, stringhe, booleani, `null`, array e oggetti di letterali). Percorsi ed
  espressioni compaiono solo nel *valore osservato* di una verifica; i segnaposto (`$parametri`, `$risultatoDi`) solo negli *input*.
  Un test controlla che nessun atteso contenga chiavi `$…`.
- **Istantanee** (`"istantanea": true`): una per ogni scenario di `scenari.ts` (F1-F4, O1-O2, A1-A2, B1-B3, AC1-AC3, D1-D5).
  L'atteso è l'**output completo** del motore TypeScript, salvato da `scripts/esporta-vettori.ts`: è l'unica eccezione
  alla regola sugli attesi e serve solo a verificare che lo Swift dia gli stessi risultati del TypeScript, chiave per chiave
  (testi degli avvisi compresi).

### Intestazione

```jsonc
{
  "versione": 2,                 // versione del formato
  "versioneMotore": "1.0.0",
  "generatoIl": "2026-10-13T13:12:00.000Z",
  "numeroVettori": 1162,
  "descrizione": "…",
  "convenzioni": { … },
  "vettori": [ … ]
}
```

### Struttura di un vettore

```jsonc
{
  "id": "forfettario/F1",
  "origine": "fiscale.test.ts › Forfettario — ... › F1: ...",   // file › describe › it
  "nota": "...",                                                // facoltativa
  "funzione": "calcolaForfettario",
  "input": { "input": { ... }, "p": { "$parametri": 2026 } },   // argomenti per nome
  "atteso": { "redditoLordo": 3120000, ... },                   // confronto parziale (esatto se istantanea)
  "verifiche": [ ... ]                                          // facoltative
}
{
  "id": "analisi/dove-vanno-100-euro-D1",
  "chiamate": {                                                 // più chiamate, eseguite in ordine
    "riepilogo": { "funzione": "calcolaRiepilogo", "input": { ... } },
    "cento":     { "funzione": "doveVanno100Euro", "input": { "r": { "$risultatoDi": "riepilogo" } } }
  },
  "verifiche": [ { "valore": { "$": "cento" }, "op": "uguale", "atteso": { "spese": 0, "imposte": 966, ... } } ]
}
```

Ogni vettore ha **o** `funzione` + `input` **o** `chiamate`, e almeno uno tra `atteso` e `verifiche`.

### Input

- Gli argomenti sono indicati per **nome del parametro** della firma TypeScript. Il runner li passa in ordine di firma;
  un argomento assente vale `undefined`, cioè il valore di default.
- Segnaposto (solo negli input):
  - `{"$parametri": 2026}` = `getParametri(2026).parametri`; con `"campo": "irpef.scaglioni"` solo quel percorso;
  - `{"$risultatoDi": "nome"}` = risultato della chiamata `nome` dello stesso vettore; con `"percorso": "fatture"` solo quella parte.
- Importi in centesimi interi; date `"aaaa-mm-gg"`; aliquote e percentuali come frazioni (`0.15`).

Funzioni usate dai vettori e nomi dei parametri, in ordine:

| funzione | parametri |
|---|---|
| `addizionaleComunale` | imponibile, codiceCatastale, tabelle, annoRiferimento |
| `addizionaleRegionale` | imponibile, regione, tabelle |
| `aliquotaForfettario` | anno, profilo, p |
| `anteprimaImportCsv` | testo, opt |
| `attribuisciVersamenti` | spese, opt |
| `avvisiRequisitiForfettario` | profilo, p |
| `bolloDovuto` | f, p |
| `calcolaForfettario` | input, p |
| `calcolaOrdinario` | input, p |
| `calcolaRiepilogo` | input |
| `cercaComune` | testo, tabelle |
| `confrontaAcconti` | baseStorica, impostaStimataAnnoCorrente, p |
| `confrontoAnnoPrecedente` | fatture, spese, oggi |
| `creditiAperti` | fatture, oggi, p |
| `csvFatture` | fatture, anno, p, opt |
| `csvSpese` | spese, anno |
| `dataIsoValida` | iso |
| `detrazioneLavoroAutonomo` | redditoComplessivo, p |
| `doveVanno100Euro` | r |
| `easterSunday` | year |
| `esportaBackup` | dati, creatoIl |
| `etaAl` | dataNascita, al |
| `generaScadenziario` | opt, p |
| `getParametri` | anno |
| `importaBackup` | testo |
| `impostaProgressiva` | imponibile, scaglioni |
| `isGiornoLavorativo` | iso |
| `liquidazioniIva` | fatture, spese, anno, p |
| `nettoIncassato` | f, p |
| `parametriDaVerificare` | p |
| `parseDataItaliana` | testo |
| `parseImporto` | raw |
| `parseInvoiceText` | text |
| `pianoAcconti` | base, p |
| `primoGiornoLavorativo` | iso |
| `proRata` | fatture, anno |
| `proiezioneAnnua` | valoreDaInizioAnno, oggi |
| `puoUsare` | stato, funzione |
| `quotaA` | anno, dataNascita, p |
| `quotaB` | annoReddito, redditoProfessionale, dataNascita, p, frazioneAnno, aliquota |
| `ricaviAnno` | fatture, anno, p, finoAl |
| `scadenzeProssimi12Mesi` | opt |
| `serieMensili` | fatture, spese, anno, p, finoAl |
| `speseDeducibili` | spese, compensi, p, percentualeDetrazioneIva |
| `spesePerCategoria` | spese, anno, finoAl |
| `statoAbbonamento` | input |
| `storicoDaTotaleAnno` | totale, opt |
| `storicoDaTotaliMensili` | mesi, opt |
| `tabelleCaricate` | tabelle |
| `validaFattura` | f, oggi |
| `validaProfilo` | p, oggi |
| `validaSpesa` | s, oggi |

### Confronto di `atteso`

**Parziale** (vettori normali):
- **oggetto**: si controllano solo le chiavi presenti nell'atteso, le altre chiavi del risultato sono ignorate;
- **array**: stessa lunghezza ed elementi confrontati uno a uno con le stesse regole;
- **`null`**: il valore deve essere `null` o assente (`undefined` in TS, `nil` in Swift);
- **numeri, stringhe, booleani**: uguaglianza esatta, senza tolleranza: i centesimi devono coincidere.

**Esatto** (istantanee): si serializza il risultato in JSON, togliendo le chiavi `undefined`/`nil` come fa `JSON.stringify`.
Poi si confronta con l'atteso: stesse chiavi (nessuna mancante, nessuna in più), stessi valori, stessi array.
I numeri decimali (aliquote, `quota`, `frazioneAnno`…) devono coincidere bit per bit: vedi le regole di arrotondamento.

### Verifiche

`{ "valore": Espr, "op": Operatore, "atteso": letterale, "cifre": n }`

**Percorsi** (`{"$": "percorso"}`): chiavi separate da `.` più selettori tra parentesi quadre.
Nella forma con `chiamate` il primo segmento è il nome della chiamata.

| selettore | significato |
|---|---|
| `[n]` | elemento n dell'array |
| `[*]` | tutti gli elementi; il resto del percorso si applica a ciascuno |
| `[k=v]` | primo elemento con `String(k) == v` |
| `[k~=regex]` | elementi con `k` che corrisponde alla regex; il resto del percorso si applica a ciascuno |
| `""` | il risultato intero |

**Espressioni** (solo nel `valore`): un letterale JSON, un percorso, oppure

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
| `{"$uguali": [a, b]}` | `true` se i due valori, serializzati in JSON, coincidono |

I controlli di relazione tra due campi si scrivono come differenza con atteso letterale, ad esempio
`{"valore": {"$diff": [{"$": "daAccantonare"}, {"$somma": [...]}]}, "op": "uguale", "atteso": 0}`.

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
| `tuttiNellIntervallo` | ogni elemento x dell'array rispetta `atteso[0] <= x < atteso[1]` |

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
- `interface Profilo` — dati del medico: regime, nascita, inizio attività, requisiti 5%, coefficiente, comune, regione,
  rate ENPAM, `aliquotaQuotaB?` (`0.195` o `0.0975`), `redditiLavoroDipendenteAnnoPrecedente?`, `rapportoCessatoEntro31_12?`,
  `redditoLavoroDipendente?` (ordinario, annuo), fatture elettroniche, `annoPrecedente`.
- `interface DatiAnnoPrecedente` — imposta "rigo differenza", addizionali, ricavi, acconti versati, reddito professionale, ritenute dell'anno precedente.
- `interface Fattura` — fattura emessa: imponibile, trattamento IVA, IVA, bollo, destinatario, ritenuta, stato, data di incasso, invio STS, `storico?`.
- `interface Spesa` — pagamento: data, importo IVA inclusa, IVA, categoria, deducibilità personalizzata, `riferimento` per F24/ENPAM, `storico?`.
- `interface RiferimentoVersamento` — `{ tributo, anno, tipo?: 'saldo' | 'acconto' }`.
- `interface Avviso` — `{ codice, livello: 'info' | 'attenzione' | 'critico', messaggio }`.

### Parametri — `params/`

- `interface Fonte` — `{ fonte, verificato, nota? }`, presente in ogni gruppo di parametri e in alcuni sottogruppi
  (`forfettario.sogliaRedditiDipendente`, `enpam.quotaA`, `enpam.quotaB.sogliaEsenzione`).
- `interface Scaglione` — `{ fino: Cents | null, aliquota }`; `null` = senza limite superiore.
- `interface ParametriAnno` — parametri normativi di un anno: forfettario, irpef, detrazioneLavoroAutonomo,
  detrazioneLavoroDipendente, acconti, enpam, iva, bollo, spese, scadenze.
- `type ParametriParziali` — anno con solo alcuni campi (es. 2025).
- `interface ParametriRisolti` — `{ parametri, approssimati }`.

### Risultati e opzioni

- `interface InputForfettario` / `RisultatoForfettario` — ingresso e dettaglio del calcolo forfettario.
- `interface InputOrdinario` (con `altriRedditi?`) / `RisultatoOrdinario` (con `altriRedditi`) — IRPEF, detrazione, addizionali; con altri redditi le imposte sono marginali.
- `interface RisultatoSpese` — spese pagate e deducibili, per categoria, con avvisi.
- `interface QuotaScaglione` — dettaglio di uno scaglione: da, a, aliquota, base, imposta.
- `interface DettaglioQuotaA` — totale, contributo base, maternità, importo mese per mese.
- `interface DettaglioQuotaB` — totale, reddito, soglia, `aliquota`, basi e quote fino al massimale e oltre.
- `interface PianoAcconti` — base, totale, prima e seconda rata, `modalita: 'nessuno' | 'unica_soluzione' | 'due_rate'`.
- `interface Proiezione` — valore annuo proiettato, frazione d'anno, affidabilità.
- `interface ConfrontoAcconti` — piano storico, piano previsionale, risparmio, avvisi.
- `interface LiquidazioneTrimestre` / `RisultatoIva` — liquidazione IVA trimestrale con pro-rata e crediti riportati.
- `interface Credito` — fattura non incassata con giorni trascorsi e importo atteso.
- `interface Esenzione` — `{ soglia, tipo: 'esclusione' | 'franchigia' }`.
- `interface AddizionaleRegionale` / `AddizionaleComunale` (con `senzaDelibera?`) — righe delle tabelle delle addizionali.
- `interface TabelleAddizionali` — `{ regionali, comunali }` indicizzate per codice.
- `interface RisultatoAddizionale` — `{ importo, avvisi }`.
- `type CategoriaScadenza`, `interface Scadenza` (con `anno`), `ImportiScadenze`, `OpzioniScadenziario`, `OpzioniScadenziarioMobile` — scadenziario e importi stimati.
- `interface VersamentoAttribuito`, `OpzioniAttribuzione`, `RisultatoAttribuzione` — attribuzione dei versamenti F24/ENPAM.
- `interface CampoLetto<T>`, `FatturaLetta` — campi letti dal testo OCR con confidenza 0-1.
- `type StatoAbbonamento = 'prova' | 'attivo' | 'scaduto'`, `type Prodotto`, `interface StatoStore`, `InputAbbonamento`, `Abbonamento`, `type Funzione` — abbonamento.
- `interface OpzioniReport` — `{ includiNomePaziente? }` per l'export CSV.
- `interface OpzioniStorico`, `CaricamentoStorico`, `TotaliPeriodo`, `TotaliMese`, `RigaScartata`, `AnteprimaImportCsv` — caricamento dello storico.
- `interface PuntoMese`, `VoceCategoria`, `DoveVanno100Euro`, `TotaliConfronto`, `ConfrontoAnnoPrecedente` — analisi.
- `interface ErroreValidazione` (`{ campo, messaggio }`), `EsitoValidazione` (`{ valido, errori }`) — validazione.
- `interface DatiBackup`, `FileBackup`, `type EsitoImportBackup` — backup.
- `interface InputRiepilogo`, `StimaImposte`, `type MetodoStima`, `DettaglioAccantonamento`, `ImpegniAnnoPrecedente`, `Riepilogo` — ingresso e uscita della dashboard.

`StimaImposte.dettaglio` è `RisultatoForfettario | RisultatoOrdinario`: in Swift un `enum` con valori associati.
`EsitoImportBackup` è `{ ok: true, dati, … } | { ok: false, errori }`: in Swift un `enum` con due casi.

---

## Funzioni pubbliche

Firme TypeScript come nel sorgente. `p: ParametriAnno` è sempre l'ultimo argomento quando serve.

### `money.ts`

- `euro(value: number): Cents` — euro (anche decimali) → centesimi: `round(value × 100)`. Non usarlo sul testo digitato: c'è `parseImporto`.
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
- `festivita(year: number): Set<IsoDate>` — festività nazionali più Pasquetta; il 4 ottobre dal 2026 (nessun santo patrono).
- `isWeekend(iso: IsoDate): boolean` — sabato o domenica.
- `isGiornoLavorativo(iso: IsoDate): boolean` — né weekend né festivo.
- `primoGiornoLavorativo(iso: IsoDate): IsoDate` — la data stessa o il primo giorno lavorativo successivo.
- `etaAl(dataNascita: IsoDate, al: IsoDate): number` — anni compiuti alla data.

### `params/`

- `getParametri(anno: number): ParametriRisolti` — parametri dell'anno. Se l'anno non è completo usa l'anno completo più vicino
  (a parità di distanza il più vecchio) con `anno` sostituito e `approssimati: true`; i campi di un anno parziale (2025)
  prevalgono con un'unione profonda (gli array si sostituiscono interi).
- `anniDisponibili(): number[]` — anni con tutti i parametri (2026, 2027).
- `parametriDaVerificare(p: ParametriAnno): string[]` — percorsi dei gruppi con `verificato: false`, in ordine di dichiarazione.

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
- `avvisiRequisitiForfettario(profilo: Pick<Profilo, 'regime' | 'redditiLavoroDipendenteAnnoPrecedente' | 'rapportoCessatoEntro31_12' | 'annoPrecedente'>, p): Avviso[]` — avvisi (non blocchi) sui redditi da lavoro dipendente oltre la soglia (salvo rapporto cessato) e sui ricavi dell'anno precedente oltre 85.000 €.
- `calcolaForfettario(input: InputForfettario, p): RisultatoForfettario` — reddito = ricavi × coefficiente, meno contributi (fino al reddito), per l'aliquota; avvisi sui limiti 85k/100k.

### `ordinario.ts` e `scaglioni.ts`

- `impostaProgressiva(imponibile: Cents, scaglioni: Scaglione[]): { totale: Cents; dettaglio: QuotaScaglione[] }` — imposta per scaglioni, arrotondata per scaglione.
- `speseDeducibili(spese: Spesa[], compensi: Cents, p, percentualeDetrazioneIva = 0): RisultatoSpese` — quota deducibile per categoria al netto dell'IVA detratta, con i limiti ristoranti (2% dei compensi) e formazione (10.000 €).
- `detrazioneLavoroAutonomo(redditoComplessivo: Cents, p): Cents` — detrazione dell'art. 13 c. 5 TUIR.
- `calcolaOrdinario(input: InputOrdinario, p): RisultatoOrdinario` — IRPEF lorda, detrazione, netta, "rigo differenza" e addizionali (nulle se l'IRPEF netta è 0).
  Con `altriRedditi` le imposte dell'attività sono **marginali**: imposte sul totale meno imposte sui soli altri redditi (senza detrazioni), minimo 0.

### `enpam.ts`

- `quotaA(anno: number, dataNascita: IsoDate, p): DettaglioQuotaA` — Quota A mese per mese secondo l'età a fine mese precedente, più maternità.
- `quotaB(annoReddito: number, redditoProfessionale: Cents, dataNascita: IsoDate, p, frazioneAnno = 1, aliquota = p.enpam.quotaB.aliquotaIntera): DettaglioQuotaB` —
  Quota B sul reddito oltre la soglia, 1% oltre il massimale; soglia e massimale × `frazioneAnno`. `p` sono i parametri dell'**anno del reddito**.

### `iva.ts`

- `trimestreDi(iso: string): 1 | 2 | 3 | 4` — trimestre della data.
- `proRata(fatture: Fattura[], anno: number): number` — percentuale di detrazione arrotondata al punto percentuale superiore (0 senza imponibili, 1 senza esenti).
- `liquidazioniIva(fatture: Fattura[], spese: Spesa[], anno: number, p): RisultatoIva` — liquidazioni trimestrali con l'1% di interessi e il credito riportato.

### `acconti.ts`

- `pianoAcconti(base: Cents, p): PianoAcconti` — nessun acconto fino a 51,65 € **compresi**, unica rata sotto 257,52 €, altrimenti due rate (50% + resto).
- `accontoAddizionaleComunale(addizionaleAnnoPrecedente: Cents, p): Cents` — 30% dell'addizionale comunale dell'anno precedente.
- `proiezioneAnnua(valoreDaInizioAnno: Cents, oggi: IsoDate): Proiezione` — proiezione lineare a fine anno; affidabile dal 60° giorno.
- `confrontaAcconti(baseStorica: Cents, impostaStimataAnnoCorrente: Cents, p): ConfrontoAcconti` — metodo storico contro previsionale, con avvisi.

### `addizionali/`

- `addizionaleRegionale(imponibile: Cents, regione: RegioneCode | undefined, tabelle = TABELLE_PRECARICATE): RisultatoAddizionale` — scaglioni, aliquota agevolata, esenzione e detrazioni; 1,23% con avviso se la regione manca.
- `addizionaleComunale(imponibile: Cents, codiceCatastale: string | undefined, tabelle = TABELLE_PRECARICATE, annoRiferimento?: number): RisultatoAddizionale` — aliquota unica o scaglioni con esenzione; codice cercato in maiuscolo; 0 con avviso se il comune manca o è `senzaDelibera`.
- `cercaComune(testo: string, tabelle = TABELLE_PRECARICATE): AddizionaleComunale[]` — comuni il cui nome inizia con il testo (minimo 2 caratteri, massimo 20 risultati), compresi quelli senza delibera.
- `tabelleCaricate(tabelle = TABELLE_PRECARICATE): { regioni; comuni; comuniSenzaDelibera }` — quante voci ci sono nelle tabelle.

### `scadenziario.ts`

- `frazioneQuotaBNellAnno(rate: 1 | 2 | 5 | 9): number` — frazione della Quota B dell'anno scorso che scade entro dicembre.
- `quotaADovutaEntro(rate: 1 | 4 | 8, totale: Cents, mese: number): Cents` — Quota A scaduta entro il mese, rata del mese compresa.
- `rataQuotaBNelMese(rate: 1 | 2 | 5 | 9, mese: number): boolean` — c'è una rata di Quota B nel mese.
- `generaScadenziario(opt: OpzioniScadenziario, p): Scadenza[]` — scadenze di un anno, ordinate per data e id, con importi stimati divisi per rata.
  Le scadenze fiscali slittano al primo giorno lavorativo, quelle ENPAM (Quota A, Quota B, Modello D) no.
- `scadenzeProssimi12Mesi(opt: OpzioniScadenziarioMobile): Scadenza[]` — scadenze da oggi (incluso) allo stesso giorno dell'anno dopo (escluso),
  unendo l'anno in corso e il successivo, ciascuno con i propri parametri; ordinate per data, anno, id. Usata da `calcolaRiepilogo`.
- `scadenzeImminenti(scadenze: Scadenza[], oggi: IsoDate, entro: IsoDate): Scadenza[]` — scadenze tra le due date, estremi inclusi.

### `versamenti.ts`

- `attribuisciVersamenti(spese: Spesa[], opt: OpzioniAttribuzione): RisultatoAttribuzione` — attribuisce i versamenti F24/ENPAM dell'anno a tributo e anno; senza riferimento usa il calendario (regole nel commento della funzione).
- `totaleVersato(versamenti: VersamentoAttribuito[], tributi: TributoVersamento[], annoRiferimento: number, tipo?: 'saldo' | 'acconto'): Cents` — somma per tributo, anno ed eventualmente tipo.

### `riepilogo.ts`

- `saldoAddizionaliAnnoPrecedente(prec: DatiAnnoPrecedente, p): Cents` — regionale intera più comunale meno l'acconto versato (o il 30% stimato).
- `aliquotaEffettivaAnnoPrecedente(profilo: Profilo, anno: number, p): number | undefined` — imposte dell'anno scorso ÷ ricavi, riproporzionata se cambia l'aliquota forfettaria.
- `calcolaRiepilogo(input: InputRiepilogo): Riepilogo` — dashboard: ricavi, stime, "da accantonare", impegni dell'anno scorso, guadagno netto, acconti, crediti, scadenze dei prossimi 12 mesi, avvisi.

### `ocr/parseInvoiceText.ts`

- `parseImporto(raw: string): Cents | undefined` — importo in formato italiano o inglese → centesimi. **Rigida**: accetta solo cifre, punti e virgole
  (più `€`, `EUR` e spazi); rifiuta segni, notazione scientifica e più di 2 decimali.
- `parseInvoiceText(text: string): FatturaLetta` — propone numero, data, totale, imponibile, bollo, trattamento IVA, ritenuta e prestazione dal testo OCR; non estrae il codice fiscale.

### `piani.ts`

- `statoAbbonamento(input: InputAbbonamento): Abbonamento` — periodo dello store in corso → `attivo` (o `prova` se lo store lo indica); altrimenti prova dell'app in corso → `prova`; altrimenti `scaduto`. Ultimi giorni inclusi.
- `puoUsare(stato: StatoAbbonamento, funzione: Funzione): boolean` — con `scaduto` solo `consultazione` ed `export`.

### `report.ts`

- `csvFatture(fatture: Fattura[], anno: number, p, opt: OpzioniReport = {}): string` — CSV con BOM UTF-8, `;` e decimali con la virgola; nome paziente solo su richiesta.
- `csvSpese(spese: Spesa[], anno: number): string` — CSV delle spese dell'anno, con BOM UTF-8.

### `storico.ts`

- `storicoDaTotaliMensili(mesi: TotaliMese[], opt: OpzioniStorico): CaricamentoStorico` — un incasso per mese e una spesa per categoria, datati a fine mese (o a oggi per il mese in corso); con errori nessun movimento.
- `storicoDaTotaleAnno(totale: TotaliPeriodo, opt: OpzioniStorico): CaricamentoStorico` — un movimento per voce, datato oggi (31/12 per un anno passato).
- `anteprimaImportCsv(testo: string, opt: OpzioniStorico): AnteprimaImportCsv` — import CSV (`data;tipo;importo;categoria;descrizione`, separatore `;` o `,`, date gg/mm/aaaa) con righe scartate e motivo.
- `parseDataItaliana(testo: string): IsoDate | undefined` — "gg/mm/aaaa" → ISO, con controllo del giorno nel mese.

### `analisi.ts`

- `serieMensili(fatture: Fattura[], spese: Spesa[], anno: number, p, finoAl?: IsoDate): PuntoMese[]` — 12 punti con incassi, spese professionali e netto.
- `spesePerCategoria(spese: Spesa[], anno: number, finoAl?: IsoDate): VoceCategoria[]` — dalla più alta, a parità per codice (confronto per codici Unicode, non `localeCompare`).
- `doveVanno100Euro(r: Riepilogo): DoveVanno100Euro | undefined` — spese, imposte, contributi e netto su 100 € incassati; la somma fa sempre 10.000 centesimi.
- `confrontoAnnoPrecedente(fatture: Fattura[], spese: Spesa[], oggi: IsoDate): ConfrontoAnnoPrecedente` — da inizio anno contro lo stesso periodo dell'anno prima.

### `validazione.ts`

- `dataIsoValida(iso: unknown): boolean` — data reale "aaaa-mm-gg".
- `validaFattura(f: Fattura, oggi?: IsoDate): EsitoValidazione` — numero, date, importi, IVA, bollo, ritenuta, stato.
- `validaSpesa(s: Spesa, oggi?: IsoDate): EsitoValidazione` — data, importi, categoria, deducibilità, riferimento del versamento.
- `validaProfilo(p: Profilo, oggi?: IsoDate): EsitoValidazione` — tutti i campi del profilo e dei dati dell'anno precedente.

I messaggi sono in italiano e pronti per l'interfaccia; i vettori li controllano parola per parola.

### `backup.ts` e `versione.ts`

- `esportaBackup(dati: DatiBackup, creatoIl: string): string` — JSON con schema, versione dello schema, versione del motore e data passata dall'app.
- `importaBackup(testo: string): EsitoImportBackup` — legge e valida (BOM ammesso): con un solo errore non restituisce dati; rifiuta versioni dello schema successive.
- `VERSIONE_MOTORE` — versione semver del motore.

---

## Costanti e dati

- `ALIQUOTA_REGIONALE_BASE = 0.0123` — usata se la regione non è in tabella.
- `PRODOTTI = ['pro_mensile', 'pro_annuale', 'founding_annuale']` — prodotti dell'abbonamento.
- `CATEGORIE_SPESA` — le 17 categorie in ordine di dichiarazione (l'ordine conta: è quello delle spese generate dallo storico).
- `MODELLO_CSV = 'data;tipo;importo;categoria;descrizione'` — intestazione del file modello per l'import.
- `BOM_UTF8 = '﻿'` — inizio dei CSV.
- `SCHEMA_BACKUP = 'lumiamed-backup'`, `VERSIONE_SCHEMA_BACKUP = 1`, `VERSIONE_MOTORE`.
- `src/core/addizionali/data/regionali.json` e `comunali.json` — tabelle MEF precaricate (7.897 comuni, di cui 885 `senzaDelibera`):
  vanno incluse **identiche** nel bundle Swift. Lo verifica `golden/checksum.json`.
- `src/core/params/2025.ts`, `2026.ts`, `2027.ts` — parametri: vanno trascritti con gli stessi valori (stessi letterali decimali,
  ad esempio `0.195`, così da ottenere gli stessi `Double`). Lo verifica `golden/parametri.json`.

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
| `pct(c, r)` | `round(c × r)`, usato per: reddito e imposta forfettari, 90% del limite, IVA della fattura, IVA detraibile, interessi IVA, acconti e prima rata, acconto e saldo dell'addizionale comunale (30%), quote ENPAM B (con l'aliquota scelta), limite ristoranti, addizionali ad aliquota unica o agevolata, imposte maturate col metodo `anno_precedente` |
| `speseDeducibili` | per **ogni spesa**: `costo = importo − pct(iva, %detrazione)`, poi `pct(costo, deducibilità)`; poi si somma per categoria e si applicano i limiti |
| `impostaProgressiva` | `round(base × aliquota)` **per scaglione**, poi somma |
| `detrazioneLavoroAutonomo` | `round(base2 + (variabile2 × (soglia2 − r)) / (soglia2 − soglia1))` e `round((base3 × (soglia3 − r)) / (soglia3 − soglia2))` |
| `calcolaOrdinario` con altri redditi | ogni voce marginale = `max(0, voce sul totale − voce sui soli altri redditi)`, ciascuna già arrotondata |
| `quotaA` | `contributoBase = round(Σ importi annui dei 12 mesi / 12)`; il dettaglio mensile è `round(annuo / 12)` (solo informativo, la somma dei mesi non è il totale) |
| `quotaB` | `soglia = round(sogliaAnnua × f)`, `massimale = round(massimale × f)`, poi `pct` sulle due basi |
| `proiezioneAnnua` | `round(valore / frazioneAnno)`, con `frazioneAnno = min(1, giorniTrascorsi / giorniAnno)` non arrotondata |
| `calcolaRiepilogo` | spese, IVA e ritenute proiettate: `round(v / f)`; altri redditi da inizio anno: `round(annui × f)`; Quota B dell'anno scorso nell'anno: `round(qb × frazioneQuotaBNellAnno)`; imposte maturate: `round(imposteProiettate × f)`; Quota A maturata: `round(totale × f)` |
| `doveVanno100Euro` | spese, imposte, contributi: `round((v × 10000) / ricavi)`; netto = `10000 − le altre tre` |
| `proRata` | punti = arrotondamento per eccesso intero di `imponibili × 100 / (imponibili + esenti)`; risultato `punti / 100` in `Double` (es. `0.2`) |
| `generaScadenziario` (rate) | `base = floor(totale / parti)` per ogni rata, l'ultima prende `totale − base × (parti − 1)`: la somma resta esatta |
| `pianoAcconti` | `secondaRata = totale − primaRata` (nessun centesimo perso) |
| `parseInvoiceText` | imponibile ricavato dal totale con IVA: `round(valore / 1.22)` |
| `csvFatture`/`csvSpese` | `(c / 100).toFixed(2)` con la virgola: in Swift `String(format: "%.2f", Double(c) / 100)` con la virgola come separatore |

Valori **non arrotondati** (`Double`): `aliquotaEffettivaAnnoPrecedente`, `percentualeLimiteForfettario`, `VoceCategoria.quota`
(`importo / totale`), `variazioneIncassi` (`(totale − precedente) / precedente`), il confronto `impostaStimata > baseStorica × 1.2` in `confrontaAcconti`.
Nelle istantanee questi valori sono confrontati esattamente: vanno calcolati con la stessa operazione.

Divisioni intere: `Math.floor(a / b)` in JS arrotonda verso −∞; la `/` tra `Int` in Swift tronca verso zero.
Sono uguali solo con operandi non negativi (oggi sempre così nello scadenziario).

**`proRata` va calcolato in aritmetica intera**: in `Double`, `(7 / 100) × 100` vale 7,000000000000001 e `ceil` salirebbe
a 8. In Swift con `Int`: `(imponibili * 100 + totale - 1) / totale` (operandi positivi). Il vettore `iva/pro-rata-esatto` lo verifica.

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
  `proiezioneAnnua`, `attribuisciVersamenti`, `statoAbbonamento`, `scadenzeProssimi12Mesi`, `confrontoAnnoPrecedente`, `OpzioniStorico`,
  validazioni; `creatoIl` del backup). Chi chiama deve passare la data **civile italiana**: in Swift
  `Calendar(identifier: .gregorian)` con `timeZone = TimeZone(identifier: "Europe/Rome")` applicato a `Date()`.
  Non usare la data UTC: tra mezzanotte e l'1-2 di notte in Italia è ancora il giorno prima.
- Giorno della settimana: JS `getUTCDay()` va da 0 = domenica a 6 = sabato; il `weekday` di `Calendar` va da 1 = domenica a 7 = sabato.
- Mesi: `ymd`, `lastDayOfMonth` e `RATE_QUOTA_*` usano i mesi 1-12; in JS `Date.UTC` vuole 0-11 (il sorgente fa `m - 1`).
  `lastDayOfMonth(y, m)` usa `Date.UTC(y, m, 0)`, cioè "giorno 0 del mese successivo".
- `isoYear` e `isoMonth` leggono le cifre dalla stringa (`slice`), senza passare da un `Date`.
- Età (`etaAl`): differenza degli anni, meno 1 se alla data non si è ancora arrivati al giorno e mese di nascita.
  Quota A: età alla fine del mese precedente (per gennaio il 31/12 dell'anno prima). Quota B: età al 31/12 dell'anno del reddito; con età < 40 si usa la soglia under 40.
- Festività: 1/1, 6/1, 25/4, 1/5, 2/6, 15/8, 1/11, 8/12, 25/12, 26/12, Pasquetta (Pasqua + 1) e, **dal 2026**, 4/10. Nessun santo patrono.
  `primoGiornoLavorativo` avanza di un giorno finché non trova un giorno lavorativo.
- Slittamenti: solo le scadenze fiscali (Sistema TS, imposte, dichiarazione, IVA, bollo). Quota A, Quota B e Modello D ENPAM restano alla data nominale.
- Finestra dello scadenziario: da `oggi` incluso a "stesso giorno dell'anno dopo" escluso; se quel giorno non esiste (29/2) si usa l'ultimo giorno del mese.
  Il confronto è sulla data **effettiva** (dopo lo slittamento).
- `confrontoAnnoPrecedente`: "stesso giorno dell'anno prima", con il 29/2 che diventa 28/2.
- `proiezioneAnnua`: `giorniAnno` = 365 o 366; `trascorsi` = giorni dal 1° gennaio a oggi **+ 1** (il 1° gennaio vale 1).
- Scadenze: si usano le date di `p.scadenze` solo se `p.scadenze.saldoPrimoAccontoIsa` è dell'anno richiesto; altrimenti le date standard (30/6, 30/11, 31/10, 31/1, 31/7).
- Storico: totali di un mese datati all'ultimo giorno del mese (o a oggi, se prima); totale dell'anno datato oggi (o 31/12 per un anno passato).
- `parseDataItaliana`: solo `g/m/aaaa` o `gg/mm/aaaa` con anno di 4 cifre e giorno valido nel mese.
- `parseInvoiceText`: accetta `g/m/a`, `g.m.a`, `g-m-a`; gli anni a 2 cifre diventano 20xx; date fuori 2000-2100 sono scartate (giorni 1-31 senza controllare il mese).

---

## Altre differenze JavaScript → Swift

- **Ordinamenti con `localeCompare`** (`generaScadenziario` e `scadenzeProssimi12Mesi` a parità di data, `attribuisciVersamenti` a parità di data,
  `csvFatture`, `csvSpese`): usano la collazione ICU, dove `"a" < "B"`; in Swift `<` confronta i codici Unicode (`"B" < "a"`).
  Sulle date ISO e sugli id attuali dello scadenziario (minuscole, cifre, trattini, con la maiuscola nella stessa posizione)
  l'ordine coincide. Per gli id generati dall'app (`Spesa.id`) conviene usare solo minuscole e cifre, così `<` basta.
  Gli ordinamenti JS sono stabili, mentre `sort` di Swift non lo garantisce. Per lo scadenziario e i versamenti non conta
  (la chiave è univoca). Per `csvFatture` e `csvSpese`, che ordinano solo per data, a parità di data va mantenuto
  l'ordine di ingresso: ordinare per (data, indice originale).
- **`undefined` e `null`**: entrambi diventano `nil`. Nelle istantanee i campi `nil` **non** compaiono nel JSON
  (come `JSON.stringify`): serializzare in Swift omettendo i `nil` (il comportamento predefinito di `JSONEncoder` per gli `Optional`).
- **Ordine delle chiavi**: nessun risultato dipende dall'ordine delle chiavi di un oggetto, ma gli **array** sì
  (es. `perCategoria` è un oggetto; `spese` dello storico segue l'ordine di `CATEGORIE_SPESA`).
- **Regex** (`parseInvoiceText`, `parseImporto`, `parseDataItaliana`, `validaProfilo`): sintassi JavaScript. In JS `\d` e `\b` sono solo ASCII,
  mentre in ICU (`NSRegularExpression`) sono Unicode: con Swift `Regex` usare `.asciiOnlyDigits()` e `.asciiOnlyWordCharacters()`.
  `.replace(',', '.')` con una stringa sostituisce **solo la prima** occorrenza, come `.replace(/EUR/i, '')`. `\s` in JS comprende anche lo spazio non separabile.
- **CSV dello storico**: le righe si dividono su `\r?\n`; le celle rispettano le virgolette (`""` = virgoletta) e sono ripulite con `trim()`.
  Il BOM iniziale (`﻿`) viene tolto.
- **Lunghezza delle stringhe**: `slice(0, 80)` conta unità UTF-16; `prefix(80)` di Swift conta caratteri.
  Per avere lo stesso risultato usare `String(s.utf16.prefix(80))` (o accettare la differenza, che riguarda solo emoji e simili).
- **`trim()`** toglie anche spazi Unicode come lo spazio non separabile: in Swift `trimmingCharacters(in: .whitespacesAndNewlines)`.
- **`toLowerCase()` / `toUpperCase()`** (`cercaComune`, codice catastale, intestazioni CSV): in Swift `lowercased()` / `uppercased()` senza locale.
- **Backup**: `JSON.stringify(file, null, 2)` (indentazione di 2 spazi, chiavi nell'ordine di dichiarazione). I vettori controllano il backup
  con regex sul testo e con il re-import, non byte per byte; per scambiare backup tra app TypeScript e Swift basta che il JSON sia equivalente.
- **Avvisi e messaggi**: le istantanee confrontano tutto l'output, quindi anche i testi di `messaggio` e dei messaggi di validazione
  vanno copiati **identici** (apostrofi diritti `'`, simbolo `€` con lo spazio come in `formatEuro`).
