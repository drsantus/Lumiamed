/**
 * Versione del motore di calcolo (semver). Va aumentata a ogni modifica di src/core:
 * - patch: correzioni che non cambiano i risultati attesi dei vettori golden;
 * - minor: funzioni o campi nuovi, risultati esistenti invariati;
 * - major: risultati diversi o firme incompatibili (il porting Swift va aggiornato).
 * È scritta nei vettori golden e nei backup.
 */
export const VERSIONE_MOTORE = '1.0.0';
