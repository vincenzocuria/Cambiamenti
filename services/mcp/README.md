# Connettore MCP del gestionale

Worker Cloudflare separato dal sito (`mcp.cambiamenti.vcuria.app`) che permette a Claude di leggere e aggiornare il gestionale: iter completo di ogni corso (bando → avvio → svolgimento → rendicontazione → incasso → chiusura), persone, scadenze, pagamenti e documenti.

## Sicurezza
- Login OAuth 2.1 (DCR + PKCE S256) con l'utente del gestionale (Supabase Auth). Solo profili `superadmin`, `admin`, `staff`.
- Nessuna chiave `service_role`: ogni query usa il JWT dell'utente, quindi valgono le regole RLS del sito.
- La sessione Supabase è salvata in D1 solo cifrata (AES-256-GCM, segreto `CAMBIAMENTI_MCP_TOKEN_KEY`); i token OAuth solo come hash. Access token 1 ora, refresh con rotazione; al refresh si ricontrolla il ruolo.
- Nessuno strumento di cancellazione. Ogni scrittura va in `public.mcp_audit_log` (migrazione `supabase/migrations/0029_mcp_audit.sql`). Mai restituiti IBAN o credenziali FAD.

## Strumenti
Lettura: `cerca_corsi`, `scheda_corso` (con iter e prossimo passo), `cerca_persone`, `scadenze`, `situazione_pagamenti` (stessa logica della pagina Pagamenti, `src/lib/paymentsSummary.ts`), `leggi_documento`, `registro_modifiche`.
Scrittura: `crea_corso`, `aggiorna_corso`, `cambia_stato_corso`, `aggiungi_nota_corso`, `registra_pagamento`, `aggiungi_lezione`, `carica_documento` (file piccoli in base64), `prepara_caricamento` + `registra_documento` (file grandi via PUT), `collega_documento`.

## Comandi (dalla cartella `services/mcp`)
- `npm ci --ignore-scripts`
- `npm run typecheck && npm test`
- Prima volta: `npx wrangler secret put CAMBIAMENTI_MCP_TOKEN_KEY` (32 byte casuali in base64; valore in Global Res `.env`, mai nel repo)
- `npm run deploy` (typecheck, test, migrazioni D1, deploy)

In Claude: Impostazioni → Connettori → Aggiungi connettore personalizzato → `https://mcp.cambiamenti.vcuria.app/mcp`.
