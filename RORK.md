# Guida per Rork

Questo repository ha già il **motore di calcolo testato** (`src/core/`) e l'**archivio locale** (`src/db/`).
Rork deve costruire **solo l'interfaccia**.

## Regole da dare a Rork (incollale nel primo messaggio)

```
Stai lavorando su LumiaMed, app Expo (SDK 57, Expo Router, TypeScript) per medici liberi professionisti italiani.
Lingua dell'interfaccia: italiano.

REGOLE NON NEGOZIABILI
1. NON modificare nulla dentro src/core/ e src/db/. Sono testati automaticamente.
   Se ti serve una funzione che non c'è, fermati e dimmelo.
2. Tutti i calcoli fiscali vengono da `import { ... } from '@/core'`. Non scrivere calcoli nelle schermate.
3. Gli importi sono in CENTESIMI (interi). Per mostrarli usa formatEuro(). Per convertire il testo digitato dall'utente usa parseImporto(testo) (accetta "1.234,56"). MAI parseFloat o Number sul testo.
4. I dati si leggono e salvano con le funzioni di '@/db/database' (leggiProfilo, salvaProfilo, elencoFatture, salvaFattura, elencoSpese, salvaSpesa...).
5. Nessun dato deve uscire dal telefono: niente backend, niente analytics con dati dell'utente.
6. Mostra sempre "Stima" accanto alle cifre fiscali e il testo: "Non è consulenza fiscale: verifica con il tuo commercialista."
7. Mostra gli avvisi (array `avvisi`) restituiti dal motore, colorati per livello: info / attenzione / critico.
```

## Schermate dell'MVP (un prompt per volta, nell'ordine)

1. **Onboarding** (salva un `Profilo`): regime (forfettario/ordinario), data di nascita, anno di apertura partita IVA, requisiti per il 5% (sì/no, con spiegazione), comune (ricerca con `cercaComune()`), regione, rate ENPAM A e B, fatture elettroniche sì/no, dati dell'anno precedente (`DatiAnnoPrecedente`, facoltativi ma consigliati: imposta, acconti versati, ricavi, reddito professionale; nell'ordinario anche ritenute e addizionali). Senza questi dati i primi 60 giorni dell'anno la stima è poco affidabile e gli impegni dell'anno scorso non compaiono.
2. **Dashboard**: usa `calcolaRiepilogo({ oggi, profilo, fatture, spese })`. Mostra: guadagno netto (`guadagnoNetto`), da accantonare (`daAccantonare`, con il dettaglio di `accantonamento`: imposte, Quota A, Quota B, IVA), impegni dell'anno scorso (`impegniAnnoPrecedente`) e liquidità impegnata (`liquiditaImpegnata`), incassato, percentuale del limite 85k (solo forfettario), prossime scadenze (`scadenzeImminenti`), crediti da incassare, avvisi.
3. **Nuova fattura (inserimento rapido)**: importo, data, tipo prestazione, paziente/struttura, trattamento IVA (default: forfettario → `forfettario_no_iva`; ordinario → `esente_art10`), bollo (proponi `bolloDovuto()`), nome paziente facoltativo, stato incassata/da incassare. Prima di salvare controlla `puoAggiungere(piano, 'fattura', contaFattureMese(...))`.
4. **Elenco fatture**: filtri per stato, segna come incassata, segna inviata al Sistema TS.
5. **Spese**: inserimento con categoria (`CategoriaSpesa`), elenco. Per le categorie `imposte_f24` e `contributi_enpam` chiedi sempre a cosa si riferisce il versamento (`riferimento`: tributo, anno, saldo/acconto).
6. **Scadenziario**: `riepilogo.scadenze` raggruppate per mese, con importo stimato.
7. **Report**: export CSV con `csvFatture()` e `csvSpese()` (condivisione file).
8. **Paywall** (RevenueCat): Free/Pro, funzioni con `puoUsare(piano, funzione)`.
9. **Foto fattura** (ultima, richiede build di sviluppo): vedi `docs/ocr-sul-telefono.md`. Il testo letto va passato a `parseInvoiceText()` e i campi vanno confermati dall'utente.

## Se Rork rompe qualcosa

- GitHub esegue i test a ogni modifica: se diventano rossi, **non chiedere a Rork di sistemarli** (consuma crediti).
  Apri Claude Code e chiedi: "i test su GitHub sono rossi, sistema".
- Se Rork ha modificato `src/core/` o `src/db/`, ripristina quei file dalla versione precedente con GitHub Desktop (History → Revert).
