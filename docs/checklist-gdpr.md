# Checklist privacy e GDPR — LumiaMed

> Bozza di lavoro, da far rivedere a un consulente privacy. Non è un parere legale.

## Perché conta

L'app può contenere il **nome del paziente** insieme al **tipo di prestazione**: è un dato relativo alla salute
(art. 9 GDPR, categoria particolare). Il titolare del trattamento di quei dati è il **medico**, non LumiaMed.
Finché i dati restano solo sul telefono e LumiaMed non vi accede, il rischio per LumiaMed è basso,
ma alcune scelte di prodotto vanno fatte con attenzione.

## Scelte già fatte nel codice

- [x] Dati salvati **solo in locale** (SQLite sul telefono), nessun server LumiaMed.
- [x] Nome del paziente **facoltativo**.
- [x] Codice fiscale letto dalle foto **mai salvato**.
- [x] Export per il commercialista **senza nome del paziente** di default (`csvFatture(..., { includiNomePaziente: false })`).
- [x] Funzione "cancella tutti i dati" (`cancellaTutto()` in `src/db/database.ts`).

## Da fare prima della pubblicazione

- [ ] **Privacy policy** pubblicata su lumiamed.app e linkata nell'app e su App Store Connect (bozza: `privacy-policy-bozza.md`).
- [ ] **App Privacy (etichette nutrizionali) su App Store Connect**: se nessun dato lascia il telefono si può dichiarare "Data Not Collected". Attenzione: RevenueCat e gli eventuali strumenti di crash/analytics raccolgono dati (identificativi, acquisti) e vanno dichiarati.
- [ ] Nessun SDK di analytics che riceva importi, nomi o prestazioni.
- [ ] **Blocco con Face ID / codice** all'apertura dell'app (consigliato: dati sanitari ed economici).
- [ ] Testo nell'app quando il medico inserisce il nome del paziente: "Il nome è facoltativo. Se lo inserisci, sei tu il titolare di questo dato."
- [ ] Backup: spiegare che il backup iCloud del telefono include i dati dell'app (cifrato da Apple) e che l'export CSV è sotto la responsabilità del medico.
- [ ] Revisione legale del disclaimer: "Le cifre sono stime e non costituiscono consulenza fiscale".
- [ ] Se in futuro si aggiunge un backend (sincronizzazione, OCR in cloud, account): servono DPA con i fornitori, registro dei trattamenti e probabilmente una valutazione d'impatto (DPIA).
