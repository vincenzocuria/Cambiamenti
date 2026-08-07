/** Corpo template Allegato 1.c — Autodichiarazione INPS. */
export const allegato1cBody = `Allegato 1.c

Autodichiarazione/Informativa su compatibilità, cumulabilità e obblighi verso INPS (NASpI-COM, ecc.)
Regione Calabria – Programma GOL - Avviso n. 4 GOL, approvato con Decreto Dirigenziale n. 12595 del 08 settembre 2025. Indennità di frequenza – Linee guida n. 1 – Avviso n. 4 GOL.

Ai sensi degli artt. 46 e 47 del D.P.R. 445/2000, consapevole delle responsabilità penali in caso di dichiarazioni mendaci, il/la sottoscritto/a dichiara quanto segue.

Sezione 1 – Dati del partecipante

Cognome e Nome: {{alunno.nome_completo}}
Codice Fiscale: {{alunno.cf}}
Residenza/Domicilio: {{alunno.indirizzo}}
Telefono/E-mail: {{alunno.telefono_email}}
IBAN intestato: {{alunno.iban}}
Ente realizzatore: {{scuola.nome}}
Titolo corso: {{corso.nome}}
ID corso catalogo: {{corso.codice}}{{corso.edizione_suffisso}}

Sezione 2 – Dichiarazioni relative a trattamenti e prestazioni

{{alunno.check_naspi}} NASpI
{{alunno.check_adi}} ADI – Assegno di Inclusione
{{alunno.check_sfl}} SFL – Supporto per la Formazione e il Lavoro
{{alunno.check_cig}} CIG/CIGS/Dis-Coll
{{alunno.check_nessuno}} Nessun trattamento

Il/La sottoscritto/a si impegna a effettuare, ove dovute, le comunicazioni obbligatorie agli enti competenti (es. NASpI-COM) nei termini e con le modalità previste.

Sezione 3 – Dichiarazioni

di essere informato/a che l’indennità di frequenza è riconosciuta nel rispetto della normativa vigente in materia di compatibilità e cumulabilità e che la stessa è concessa esclusivamente al verificarsi delle condizioni e secondo le modalità previste dalle Linee Guida n. 1 - Avviso n. 4 GOL;
di essere a conoscenza che eventuali riduzioni/sospensioni/decadenze di trattamenti INPS non sono imputabili alla Regione;
di impegnarsi a comunicare tempestivamente all’ente eventuali variazioni della propria posizione;
di essere a conoscenza del divieto di doppio finanziamento per le stesse ore/attività.

Sezione 4 – Informativa privacy (sintesi)

Il trattamento dei dati avviene nel rispetto del Regolamento (UE) 2016/679 e del D.Lgs. 196/2003. Titolare: Regione Calabria – Dipartimento Lavoro. L’ente realizzatore opera quale Responsabile ex art. 28 GDPR.

Luogo e data: {{oggi}}
Firma del partecipante: _______________________________

Allegare copia documento d’identità in corso di validità.`
