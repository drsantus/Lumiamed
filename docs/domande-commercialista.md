# Domande per il commercialista

Punti del motore di LumiaMed con `verificato: false`: finché non sono confermati, l'app mostra le cifre come **stima**.
I valori sono quelli in `src/core/params/`. I casi di prova da controllare sono nel file Excel
`docs/LumiaMed_verifica_commercialista.xlsx`; il foglio "Parametri" ha anche la colonna "Verificato".

Quando un punto è confermato: mettere `verificato: true` nel file dei parametri e aggiornare questo elenco.

## Parametri 2026

### Forfettario (`forfettario`)
- Limite ricavi 85.000 €, uscita immediata oltre 100.000 €.
- Coefficiente di redditività 78% (ATECO 86.21 / 86.22 / 86.23).
- Aliquota 5% per i primi 5 anni con i requisiti, poi 15%.

### Soglia dei redditi da lavoro dipendente (`forfettario.sogliaRedditiDipendente`)
- 35.000 € per il 2026 (redditi 2025). Fonte: L. 190/2014 art. 1 c. 57 lett. d-ter.
- L'app mostra solo un **avviso** (non un blocco) se si supera la soglia, e non lo mostra se il rapporto di lavoro è cessato entro il 31/12. Questa gestione è corretta?

### IRPEF (`irpef`)
- Scaglioni 2026: 23% fino a 28.000 €, 33% fino a 50.000 €, 43% oltre (L. 199/2025).

### Detrazione per lavoro autonomo (`detrazioneLavoroAutonomo`)
- Art. 13 c. 5 TUIR: 1.265 € fino a 5.500 €; 500 + 765 × (28.000 − reddito) / 22.500 fino a 28.000 €; 500 × (50.000 − reddito) / 22.000 fino a 50.000 €.

### Detrazione per lavoro dipendente (`detrazioneLavoroDipendente`)
- L'app **non calcola** la detrazione per lavoro dipendente. Usa solo la soglia di 50.000 € (oltre la quale la detrazione è zero) per avvisare che la stima è approssimata.
- Medici ordinari con stipendio (es. ospedalieri in extramoenia): le imposte dell'attività sono calcolate in modo **marginale**,
  cioè IRPEF e addizionali sul totale meno quelle sul solo stipendio. Esempio con 60.000 € di stipendio e 30.000 € di reddito professionale, in Sardegna:
  IRPEF 12.900 € + addizionale regionale 369 € = 13.269 €. Il metodo è corretto? Serve gestire la detrazione per lavoro dipendente sotto i 50.000 €?

### Acconti (`acconti`)
- Nessun acconto sotto 51,65 €; unica soluzione a novembre sotto 257,52 €; altrimenti due rate da 50% (soggetti ISA e forfettari).
- Acconto dell'addizionale comunale: 30% dell'addizionale dell'anno precedente.

### ENPAM — Quota B (`enpam`)
- Aliquota intera 19,5%; aliquota ridotta 9,75% su scelta del medico; massimale 150.000 €; 1% oltre il massimale.
- Con l'aliquota ridotta l'app la applica solo fino al massimale e lascia l'1% oltre il massimale. È corretto?
- La Quota B usa i parametri dell'anno del reddito e l'età al 31/12 di quell'anno.

### ENPAM — soglie della Quota B sui redditi 2026 (`enpam.quotaB.sogliaEsenzione`)
- Under 40: 5.691,90 €; over 40: 10.511,95 €.
- **Stima**: Quota A 2026 ÷ 19,5%. ENPAM le pubblica con il Modello D 2027.

### IVA (`iva`)
- Aliquota 22% per le prestazioni non sanitarie; interessi dell'1% sulle liquidazioni trimestrali.

### Bollo (`bollo`)
- 2 € sulle fatture senza IVA sopra 77,47 €.
- D.Lgs. 192/2024: dal 2025 i rimborsi di spese addebitate al cliente non concorrono al reddito di lavoro autonomo. Vale anche per il bollo riaddebitato e per i forfettari? Oggi l'app lo **esclude** dal reddito.

### Spese deducibili nell'ordinario (`spese`)
- Percentuali per categoria (telefono 80%, auto 20% senza il limite di costo del veicolo, ristoranti 75% entro il 2% dei compensi, formazione fino a 10.000 €, attrezzature dedotte tutte subito).
- Fonte: art. 54 TUIR prima della riforma del D.Lgs. 192/2024. Cosa cambia con la riforma?

### Scadenze 2026 (`scadenze`)
- Saldo e 1° acconto ISA/forfettari: 20/7/2026 (proroga); 2° acconto 30/11; dichiarazione 31/10; Sistema TS 31/1; Modello D 31/7.

## Parametri 2025 (solo Quota B)

`params/2025.ts` contiene solo le soglie della Quota B sui redditi 2025, già verificate (enpam.it, agg. 3/2/2026):
5.446,77 € under 40 e 10.059,28 € over 40. Tutti gli altri parametri del 2025 vengono dal 2026 e risultano quindi da verificare:
servono solo per calcoli sull'anno 2025 (Quota B pagata nel 2026, aliquota forfettaria dell'anno scorso).

## Parametri 2027 (provvisori)

`params/2027.ts` è una copia del 2026 con **tutto** da verificare, da rivedere dopo la legge di bilancio 2027:
- soglia dei redditi da lavoro dipendente per il forfettario: 30.000 €;
- Quota A 2027: per ora gli stessi importi del 2026;
- scadenze: date standard (30/6, 30/11, 31/10, 31/1, 31/7), senza proroghe.

## Altre scelte del motore da confermare

- Ricavi dell'anno precedente sopra 85.000 € nel forfettario: avviso **critico** ("quest'anno non puoi restare nel forfettario").
