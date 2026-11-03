# PEC di Cambia-Menti nel gestionale

Le caselle PEC Aruba (`CAMBIAMENTI_PEC_*` in `Global Res\.env`) si leggono solo dal PC: dal cloud
l'IMAP di Aruba non è raggiungibile. Lo script apre le caselle **in sola lettura** (nessun messaggio
segnato come letto o spostato) e copia nel gestionale le PEC nuove di `INBOX` e `INBOX.Inviata`:

- tabella `pec_messages` (oggetto senza «POSTA CERTIFICATA:», mittente, testo, data) e `pec_attachments`;
- la busta Aruba (`postacert.eml`) viene aperta: si salvano il messaggio originale e i suoi allegati;
- gli allegati vanno nel bucket `documents` sotto `pec/<id>/`, con il testo dei PDF (anche dentro i `.p7m`);
- le ricevute di accettazione/consegna sono segnate subito come `ignorata`.

| Comando | Cosa fa |
| --- | --- |
| `npm run pec -- sincronizza` | Copia le PEC nuove (riprende dall'ultima copiata) |

Il servizio Aruba sul PC (`npm run aruba -- servizio`) lo fa da solo una volta al giorno.
Claude le elabora con il connettore MCP (`posta_da_elaborare`, `leggi_pec`, `allega_pec_a_corso`,
`segna_pec`); l'esito si vede nella pagina **Posta da verificare** del gestionale.
