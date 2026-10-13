# Guida per Rork — v2 (bozza)

> **Bozza.** Le scelte di prodotto ancora aperte sono segnate con **[DA DECIDERE]**.

LumiaMed è un'app per iPhone in **SwiftUI** per medici liberi professionisti italiani: incassi, spese,
stime di imposte ed ENPAM, scadenziario, report per il commercialista. Tutti i dati restano sul telefono.

| Parte | Dove | Chi ci lavora |
|---|---|---|
| **Motore di calcolo** (Swift) | tradotto da `src/core/` di questo repository; verificato con `golden/` (vedi `docs/PORTING.md`) | non Rork |
| **Archivio** | SwiftData sul telefono | Rork, solo per salvare e leggere i dati |
| **Interfaccia** | schermate SwiftUI | **Rork** |

I nomi di funzioni, tipi e campi del motore Swift sono gli stessi del motore TypeScript (`docs/PORTING.md`, sezioni
"Tipi pubblici" e "Funzioni pubbliche"). Il progetto Expo in questo repository contiene solo un segnaposto: **non è l'app**.

## Regole da dare a Rork (incollale nel primo messaggio)

```
Stai lavorando su LumiaMed, app iPhone in SwiftUI per medici liberi professionisti italiani.
Lingua dell'interfaccia: italiano.

REGOLA PRINCIPALE: l'interfaccia non calcola nulla, chiama solo il motore.
Ogni cifra fiscale, data di scadenza, controllo dei dati o stato dell'abbonamento viene da una funzione
del motore LumiaMedCore. Nelle schermate niente somme, percentuali, arrotondamenti o date calcolate a mano.

REGOLE NON NEGOZIABILI
1. NON modificare il motore (LumiaMedCore) né i file golden. Se ti serve una funzione che non c'è,
   fermati e dimmelo.
2. Gli importi sono in CENTESIMI (Int). Per mostrarli usa formatEuro().
   Per leggere un importo digitato usa SOLO parseImporto(testo): restituisce nil se il testo non è valido
   (negativi, lettere, più di 2 decimali) e allora mostri l'errore. Mai Double(testo), mai euro(numero).
3. "Oggi" è la data civile italiana: calcolala una volta con un Calendar gregoriano e il fuso
   "Europe/Rome", poi passala al motore come stringa "aaaa-mm-gg". Mai Calendar.current.
4. Prima di salvare usa validaFattura / validaSpesa / validaProfilo e mostra ogni messaggio accanto al
   campo indicato da `campo`. Non salvare se `valido` è false.
5. Nessun dato esce dal telefono: niente backend, niente analytics con dati dell'utente. Archivio: SwiftData.
6. Mostra "Stima" accanto alle cifre fiscali quando riepilogo.parametriDaVerificare non è vuoto o
   riepilogo.parametriApprossimati è true, con il testo:
   "Non è consulenza fiscale: verifica con il tuo commercialista."
7. Mostra gli avvisi (array `avvisi`) restituiti dal motore, colorati per livello: info / attenzione / critico.
8. Abbonamento: lo stato lo calcola statoAbbonamento(); cosa si può fare lo dice puoUsare(stato, funzione).
   Non ci sono piani Free/Pro né limiti sul numero di fatture o spese.
   Con l'abbonamento scaduto l'app è in sola lettura, ma l'export resta sempre disponibile.
```

## Schermate (un prompt per volta, nell'ordine)

1. **Onboarding / Profilo** (salva un `Profilo`, controllato con `validaProfilo`)
   - regime (forfettario/ordinario), data di nascita, anno di apertura della partita IVA, requisiti per il 5% (sì/no, con spiegazione);
   - comune con la ricerca `cercaComune()` (se il comune è `senzaDelibera` mostra l'avviso che l'addizionale non è stimata), regione;
   - rate ENPAM A e B; aliquota della Quota B: **19,5% (predefinita) o 9,75%**, nient'altro (il 2% vale solo per l'intramoenia e non va offerto);
   - forfettario: redditi da lavoro dipendente dell'anno precedente e "rapporto cessato entro il 31/12";
   - ordinario: reddito da lavoro dipendente atteso nell'anno (es. ospedaliero in extramoenia);
   - fatture elettroniche sì/no; dati dell'anno precedente (`DatiAnnoPrecedente`, facoltativi ma consigliati).
   - Proponi subito il caricamento dello storico (schermata 6) se l'anno è già iniziato.
2. **Dashboard**: `calcolaRiepilogo({ oggi, profilo, fatture, spese })`.
   Guadagno netto, da accantonare (con il dettaglio di `accantonamento`), impegni dell'anno scorso, liquidità impegnata,
   incassato, percentuale del limite 85.000 € (solo forfettario), prossime scadenze (`scadenzeImminenti`), crediti, avvisi.
   Riquadro "Dove vanno 100 €" con `doveVanno100Euro(riepilogo)`.
3. **Nuova fattura** (inserimento rapido): importo (`parseImporto`), data, tipo prestazione, paziente/struttura,
   trattamento IVA (default: forfettario → `forfettario_no_iva`; ordinario → `esente_art10`), bollo (proponi `bolloDovuto()`),
   nome paziente facoltativo (è un dato sanitario: avvisa), stato incassata/da incassare. Salva solo se `validaFattura` è valido.
4. **Elenco fatture**: filtri per stato, segna come incassata, segna inviata al Sistema TS. Le fatture con `storico: true` sono
   totali caricati con lo storico: mostrale con un'etichetta "Storico".
5. **Spese**: inserimento con categoria (`CATEGORIE_SPESA`) ed elenco. Per `imposte_f24` e `contributi_enpam` chiedi sempre
   a cosa si riferisce il versamento (`riferimento`: tributo, anno, saldo/acconto). Salva solo se `validaSpesa` è valido.
6. **Storico (caricamento rapido dei dati da inizio anno)**, con tre modalità:
   - totali mese per mese → `storicoDaTotaliMensili(mesi, opt)`;
   - totale da inizio anno come unica cifra → `storicoDaTotaleAnno(totale, opt)`;
   - import di un file CSV → `anteprimaImportCsv(testo, opt)`: mostra **l'anteprima** (movimenti, totali, righe scartate con il motivo)
     e salva solo dopo la conferma. Offri il file modello con l'intestazione `MODELLO_CSV`.
   - Se `errori` non è vuoto mostrali e non salvare nulla. `prefissoId` deve essere univoco per ogni caricamento.
   - **[DA DECIDERE]** come "dettagliare dopo" un totale storico (sostituirlo con le fatture vere? scalarlo?).
7. **Analisi**: `serieMensili` (grafico di incassi, spese e netto), `spesePerCategoria`, `doveVanno100Euro`,
   `confrontoAnnoPrecedente` (stesso periodo dell'anno scorso, con `variazioneIncassi`).
   **[DA DECIDERE]** tipi di grafico e periodo selezionabile.
8. **Scadenziario**: `riepilogo.scadenze` copre i prossimi 12 mesi; raggruppale per mese, con l'importo stimato.
   Una scadenza si identifica con la coppia (`anno`, `id`). **[DA DECIDERE]** notifiche: quanti giorni prima, quali categorie.
9. **Report ed export**: `csvFatture()` e `csvSpese()` (già con il BOM per Excel), condivisione del file;
   backup con `esportaBackup(dati, creatoIl)` e ripristino con `importaBackup(testo)`. Prima di sovrascrivere i dati chiedi conferma;
   se l'import non è valido mostra l'elenco `errori` e non toccare l'archivio.
10. **Abbonamento**: `statoAbbonamento({ oggi, store, fineProvaApp })` con i dati di StoreKit; prodotti `PRODOTTI`
    (`pro_mensile`, `pro_annuale`, `founding_annuale`).
    **[DA DECIDERE]** prezzi e testi dei prodotti; chi gestisce la prova di 30 giorni (l'app con `fineProvaApp` o l'App Store);
    condizioni dell'offerta "founding".
11. **Info / Impostazioni**:
    - versione del motore (`VERSIONE_MOTORE`) e anno dei parametri usati (`riepilogo.anno`; se `parametriApprossimati` è true scrivi
      "parametri dell'anno più vicino");
    - elenco dei parametri ancora da verificare (`parametriDaVerificare`);
    - backup e ripristino, informativa privacy (`docs/privacy-policy-bozza.md`), fonte dei dati delle addizionali (MEF);
    - **[DA DECIDERE]** contatti, link di supporto, eliminazione di tutti i dati.
12. **Foto fattura** (ultima): testo letto con Vision sul telefono (`docs/ocr-sul-telefono.md`) → `parseInvoiceText()`;
    i campi vanno sempre confermati dall'utente e il codice fiscale non viene salvato.

## Stati vuoti ed errori

| Situazione | Cosa mostrare |
|---|---|
| Primo avvio, nessun profilo | onboarding; niente dashboard finché `validaProfilo` non è valido |
| Nessuna fattura né spesa | dashboard con il messaggio "Aggiungi la prima fattura o carica i dati da inizio anno" e i due pulsanti |
| `doveVanno100Euro` restituisce `nil` (nessun ricavo) | il riquadro spiega che servono incassi; nessun grafico vuoto |
| Analisi senza dati dell'anno precedente (`variazioneIncassi` assente) | "Nessun dato dell'anno scorso da confrontare" |
| Primi 60 giorni dell'anno (avviso `STIMA_POCO_AFFIDABILE`) | invito a inserire i dati dell'anno precedente |
| `parametriApprossimati` (anno nuovo senza parametri aggiornati) | banner: le stime usano i parametri dell'anno più vicino |
| Comune senza delibera (`ADD_COM_SENZA_DELIBERA`) | avviso accanto all'addizionale comunale |
| Errori di validazione | messaggio sotto il campo indicato da `campo`, pulsante Salva disattivato |
| Importo non leggibile (`parseImporto` → `nil`) | "Importo non valido" sotto il campo |
| Import CSV con righe scartate | elenco con numero di riga, testo e motivo; si salvano solo le righe valide, dopo conferma |
| Import CSV con `errori` (file vuoto, intestazione sbagliata) | messaggio e link al file modello |
| Backup non valido o di una versione più recente | elenco `errori`; archivio invariato |
| Abbonamento scaduto | banner "Sola lettura": inserimento disattivato, consultazione ed export disponibili |
| OCR illeggibile | avvisi di `parseInvoiceText` e passaggio all'inserimento manuale |

**[DA DECIDERE]** stile e testi definitivi degli stati vuoti (illustrazioni, tono).

## Se Rork rompe qualcosa

- Il motore e i file golden non si modificano dall'interfaccia: se servono cambiamenti, apri Claude Code su questo repository.
- GitHub esegue i test del motore a ogni modifica: se diventano rossi, **non chiedere a Rork di sistemarli** (consuma crediti).
  Apri Claude Code e chiedi: "i test su GitHub sono rossi, sistema".
