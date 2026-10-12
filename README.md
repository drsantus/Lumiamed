# LumiaMed

App iPhone per la gestione finanziaria dei medici liberi professionisti italiani:
incassi, spese, stime di tasse ed ENPAM, scadenziario, report per il commercialista.
Tutti i dati restano sul telefono.

## Come è organizzato il progetto

| Cartella | Cosa contiene | Chi ci lavora |
|---|---|---|
| `src/core/` | **Motore di calcolo**: forfettario, ordinario (IRPEF, addizionali, IVA), ENPAM, acconti, scadenziario, lettura del testo delle fatture, limiti dei piani | Claude Code — **Rork non deve modificarlo** |
| `src/core/__tests__/` | Test automatici e casi fiscali (`scenari.ts`) | Claude Code |
| `src/core/params/` | Parametri normativi per anno (aliquote, soglie, scadenze) | Claude Code + verifica del commercialista |
| `src/core/addizionali/data/` | Tabelle precaricate delle addizionali (dati ufficiali MEF) | Generate da `npm run import-addizionali` |
| `src/db/` | Archivio locale SQLite | Claude Code |
| `src/app/`, `src/components/` | Interfaccia (schermate) | **Rork** |
| `docs/` | Excel per il commercialista, privacy, GDPR, lettura foto | — |

## Comandi

```bash
npm install                # una volta sola
npm test                   # esegue tutti i test del motore
npm run check              # typecheck + test (lo stesso controllo di GitHub)
npm run casi-test          # esporta casi e parametri in docs/casi-test.json
python scripts/genera_excel_commercialista.py   # crea l'Excel per il commercialista
npm run import-addizionali # rigenera le tabelle dai CSV del MEF in "raw data/"
npx expo start             # avvia l'app in sviluppo
```

## Regole d'oro

1. **Tutti gli importi sono in centesimi** (numeri interi). Usare `euro(150)` → `15000`, e `formatEuro()` per mostrarli.
2. L'interfaccia importa solo da `@/core` (e da `@/db` per salvare). Nessun calcolo fiscale nelle schermate.
3. Ogni cambiamento normativo si fa in `src/core/params/AAAA.ts`, poi si aggiornano i casi in `scenari.ts`.
4. Finché un gruppo di parametri ha `verificato: false`, l'app mostra le cifre come **stima**.
5. A ogni push GitHub esegue i test (`.github/workflows/test.yml`). Se diventano rossi, il calcolo è rotto.

## Stato dei dati fiscali (ottobre 2026)

- Tutti i parametri 2026 sono **da verificare** con il commercialista: `docs/LumiaMed_verifica_commercialista.xlsx`.
- Quota A ENPAM 2026: le fonti pubbliche non concordano sugli importi (vedi nota in `params/2026.ts`).
- Addizionali comunali: 7.012 comuni su 7.897 dagli elenchi MEF 2023-2026 (per ogni comune l'ultima delibera disponibile). Per gli 885 comuni senza delibere dal 2023 (es. Portoscuso) aggiungere gli elenchi 2020-2022 in `raw data/` e rilanciare `npm run import-addizionali`.
- Addizionali regionali 2026: tutte le 21 regioni/province autonome, trascritte dalle pagine MEF (`addregirpef.php`) in `src/core/addizionali/data/regionali.json`. Le agevolazioni per figli e disabilità non sono applicate (l'app lo segnala). Da verificare ogni anno: il MEF non offre un file scaricabile.

## Lavorare con Rork

Vedi [RORK.md](RORK.md).
