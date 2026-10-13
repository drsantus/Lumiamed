# LumiaMed — regole del progetto

App Expo per la gestione finanziaria dei medici liberi professionisti italiani. Lingua: italiano.

## Architettura
- `src/core/`: motore di calcolo fiscale, TypeScript puro. **Nessun import di React, React Native o Expo.**
  Coperto da test (`npm test`). Ogni modifica a `src/core/` deve lasciare i test verdi.
- `src/core/params/AAAA.ts`: parametri normativi per anno, con fonte e flag `verificato`.
- `src/core/__tests__/scenari.ts`: casi fiscali condivisi con il commercialista (Excel in `docs/`).
- `src/db/`: archivio locale expo-sqlite. I dati non lasciano il dispositivo.
- `src/app/`: solo un segnaposto. L'app per iPhone è in SwiftUI e usa il motore tradotto in Swift (`RORK.md`, `docs/PORTING.md`).
- `golden/`: vettori, parametri e checksum per verificare il porting in Swift. Si rigenerano con `npm run vettori`.
- Il motore non legge la data di oggi, non usa numeri casuali e non importa Expo né API di Node: tutto arriva come parametro.

## Convenzioni
- Importi in centesimi interi (`Cents`). Date ISO `YYYY-MM-DD`, calcoli in UTC.
- Principio di cassa: ricavi per data di incasso, spese per data di pagamento.
- Prima di dichiarare finito: `npm run check` (typecheck del motore + test).
- Se cambia una regola fiscale: aggiorna `params/`, poi `scenari.ts`, poi rigenera l'Excel (`npm run casi-test` + `python scripts/genera_excel_commercialista.py`).
- Vettori golden per il porting in Swift (`golden/`, vedi `docs/PORTING.md`): dopo ogni modifica al motore, a `scenari.ts`,
  ai casi di test, ai parametri o alle tabelle delle addizionali rigenerali con `npm run vettori` (altrimenti `vettori.test.ts` fallisce).
  Ogni test nuovo va trascritto in `vettori-casi.ts` / `vettori-casi-bc.ts` con attesi letterali.
  A ogni modifica del motore aggiorna `VERSIONE_MOTORE` (`src/core/versione.ts`).
- Test del solo motore, senza Expo (come la CI): `npm run test:motore`.

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
