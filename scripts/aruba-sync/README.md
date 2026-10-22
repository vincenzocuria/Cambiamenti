# Fatture Aruba dal PC (senza API)

Le API di Aruba Fatturazione Elettronica non sono attive sul nostro piano (errore 0093), quindi
questo script usa il pannello web come lo usi tu: apre Microsoft Edge con un profilo dedicato
(`%USERPROFILE%\.cambiamenti-aruba`), entra con le credenziali `CAMBIAMENTI_ARUBA_FE_*` del file
centrale `Global Res\.env` e chiama le stesse funzioni interne che usa la pagina.

| Comando | Cosa fa |
| --- | --- |
| `npm run aruba -- accedi` | Login (l'OTP lo inserisci tu); la sessione resta salvata |
| `npm run aruba -- sincronizza [anni...]` (es. `2025 2026`) | Scarica emesse e ricevute che mancano in Cambiamenti, le importa e aggiorna lo stato SdI delle emesse |
| `npm run aruba -- sincronizza --nascosto` | Come sopra, senza finestra (per l'Utilità di pianificazione) |
| `npm run aruba -- invia` | Carica nelle **bozze** di Aruba le fatture preparate in Cambiamenti, con conferma una per una |
| `npm run aruba -- importa <percorso>` | Importa XML/P7M/ZIP da file o cartella |
| `npm run aruba -- esplora` / `codice` | Solo per lo sviluppo: registra com'è fatto il pannello |

`invia` non manda niente allo SdI: la fattura finisce nelle Bozze del pannello, dove la controlli
e premi «Invia». Alla sincronizzazione successiva Cambiamenti prende il file e lo stato SdI.

I file scaricati restano in `scripts/aruba-sync/.data/scaricate/` (fuori da git).
Se Aruba cambia il pannello, le chiamate in `panelApi.ts` vanno aggiornate (rilancia `codice`).
