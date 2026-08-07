/** Corpo template Allegato 5.c — Rinuncia all’indennità di frequenza. */
export const allegato5cBody = `Allegato 5.c - Modulo di rinuncia all’indennità di frequenza

DICHIARAZIONE SOSTITUTIVA DI ATTO DI NOTORIETÀ
(artt. 46 e 47 D.P.R. 28 dicembre 2000, n. 445)

Il/La sottoscritto/a
Nome e Cognome: {{alunno.nome_completo}}
Codice Fiscale: {{alunno.cf}}
Nato/a a: {{alunno.luogo_nascita}} il {{alunno.data_nascita}}
Residente in: {{alunno.indirizzo}}

consapevole delle responsabilità penali previste dall’art. 76 del D.P.R. n. 445/2000 in caso di dichiarazioni mendaci,

DICHIARA
di aver partecipato al percorso formativo “{{corso.nome}}” (ID Corso {{corso.codice}}{{corso.edizione_suffisso}} CUP {{corso.cup}});
di aver maturato il diritto all’indennità di frequenza ai sensi delle Linee guida del Programma GOL;
di essere stato/a informato/a delle modalità di erogazione e del trattamento fiscale dell’indennità;

RINUNCIA ESPRESSAMENTE
in modo libero, volontario e consapevole, all’indennità di frequenza maturata in relazione al percorso sopra indicato.

La presente rinuncia:
riguarda l’intero importo dell’indennità spettante;
comporta la non liquidazione dell’indennità;
esclude ogni pretesa presente o futura nei confronti dell’Ente di formazione e dell’Amministrazione.

DICHIARA INOLTRE
di essere consapevole che, a seguito della presente rinuncia, non verrà disposto alcun pagamento;
di sollevare l’Ente di formazione e l’Amministrazione/Regione da ogni responsabilità connessa alla mancata erogazione dell’indennità;
che la presente rinuncia è resa senza costrizioni, pressioni o condizionamenti.

CASO DI PARTECIPANTE MINORENNE
(compilare solo se il destinatario è minorenne)

TRATTAMENTO DEI DATI PERSONALI
I dati personali contenuti nella presente dichiarazione saranno trattati esclusivamente per le finalità amministrative, contabili, fiscali, di rendicontazione, controllo e pagamento connesse all’attuazione dell’intervento, nel rispetto del Regolamento (UE) 2016/679 e della normativa nazionale vigente in materia di protezione dei dati personali.

Il/La sottoscritto/a dichiara di aver ricevuto o preso visione dell’informativa sul trattamento dei dati personali resa dall’Ente di formazione ai sensi della normativa vigente.

Luogo e data {{oggi}}
Firma del destinatario maggiorenne
(oppure del genitore/tutore in caso di minore)
__________________________________`
