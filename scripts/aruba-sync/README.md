# Fatture Aruba dal PC (senza API)

Le API di Aruba Fatturazione Elettronica non sono attive sul nostro piano (errore 0093), quindi
questo script usa il pannello web come lo usi tu: apre Microsoft Edge con un profilo dedicato
(`%USERPROFILE%\.cambiamenti-aruba`), entra con le credenziali `CAMBIAMENTI_ARUBA_FE_*` del file
centrale `Global Res\.env` e chiama le stesse funzioni interne che usa la pagina.

| Comando | Cosa fa |
| --- | --- |
| `npm run aruba -- accedi` | Login (l'OTP lo inserisci tu); la sessione resta salvata |
| `npm run aruba -- sincronizza [anni...]` (es. `2025 2026`) | Scarica emesse e ricevute che mancano in Cambiamenti, le importa e aggiorna stato SdI e data d'incasso delle emesse |
| `npm run aruba -- sincronizza --nascosto` | Come sopra, senza finestra (per l'Utilità di pianificazione) |
| `npm run aruba -- anagrafiche` | Crea clienti/fornitori e corsisti EIPASS dalle fatture già importate e ricollega le note di debito ai corsi |
| `npm run aruba -- servizio [--ogni 6]` | Resta acceso: esegue il tasto «Sincronizza con Aruba» del gestionale e sincronizza da solo ogni 6 ore |
| `npm run aruba -- installa-servizio` | Fa partire il servizio da solo all'accesso a Windows, senza finestra (`disinstalla-servizio` per toglierlo) |
| `npm run aruba -- invia` | Carica nelle **bozze** di Aruba le fatture preparate in Cambiamenti, con conferma una per una |
| `npm run aruba -- importa <percorso>` | Importa XML/P7M/ZIP da file o cartella |
| `npm run aruba -- esplora` / `codice` | Solo per lo sviluppo: registra com'è fatto il pannello |

`invia` non manda niente allo SdI: la fattura finisce nelle Bozze del pannello, dove la controlli
e premi «Invia». Alla sincronizzazione successiva Cambiamenti prende il file e lo stato SdI.

Il tasto «Sincronizza con Aruba» in Fatturazione funziona solo con il PC acceso e il servizio attivo: Aruba non si
apre dal server. Se la sessione Aruba scade (nuovo OTP), il gestionale mostra l'errore: lancia una volta
`npm run aruba -- accedi`. Il registro del servizio è in `.data/servizio.log`.

Lancia un comando alla volta: due comandi insieme usano lo stesso profilo di Edge e il secondo si ferma.
Se il pannello non si carica al primo colpo (ERR_ABORTED) lo script riprova da solo.

I file scaricati restano in `scripts/aruba-sync/.data/scaricate/` (fuori da git).
Se Aruba cambia il pannello, le chiamate in `panelApi.ts` vanno aggiornate (rilancia `codice`).
