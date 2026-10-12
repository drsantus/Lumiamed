# Lettura delle fatture da foto (sul telefono)

**Decisione:** il testo della foto viene letto sull'iPhone. L'immagine e i dati non vengono inviati a nessun server.

## Come funziona

1. L'utente scatta o sceglie una foto (`expo-image-picker` o `expo-camera`).
2. Un modulo nativo di riconoscimento del testo (OCR) estrae il testo dall'immagine:
   - su iPhone usa **Apple Vision** (`VNRecognizeTextRequest`, supporta l'italiano);
   - su Android userebbe ML Kit.
3. Il testo viene passato a `parseInvoiceText(testo)` (in `src/core/ocr/`, già testato).
4. L'app mostra i campi trovati (numero, data, importo, bollo, IVA, prestazione) con la loro **confidenza**.
   L'utente conferma o corregge. **Nulla viene salvato senza conferma.**
5. Il codice fiscale del paziente, se c'è nella foto, viene segnalato ma **non salvato**.
6. La foto non viene conservata, a meno che l'utente non scelga di allegarla.

## Cosa serve

- Un modulo OCR compatibile con Expo SDK 57. Opzioni da valutare al momento dello sviluppo:
  - una libreria della community che espone Apple Vision e ML Kit (verificare la compatibilità con SDK 57 e la New Architecture);
  - un piccolo **Expo Module** scritto apposta (Swift, circa 50 righe) che chiama Apple Vision: è la soluzione con meno dipendenze.
- Una **build di sviluppo** (`npx eas-cli@latest build --profile development --platform ios`): il riconoscimento del testo non funziona in Expo Go né nell'anteprima rapida di Rork.

## Test

- La parte di interpretazione del testo è coperta da `src/core/__tests__/ocr.test.ts`.
- Quando arriveranno foto vere di fatture (anonimizzate), aggiungere il testo letto come nuovo caso di test.
