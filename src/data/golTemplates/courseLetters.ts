/**
 * Lettere a livello di corso (nessuna persona) generate dai passi dell'iter.
 * Le parti da completare a mano restano come righe «____».
 */

const header = `{{scuola.ragione_sociale}}
Sede: {{scuola.sede}}
C.F./P.IVA {{scuola.cf}} · PEC {{scuola.pec}}
Ente accreditato – {{scuola.accreditamento}}

Spett.le Regione Calabria
Dipartimento Lavoro – Settore competente
Via PEC

{{scuola.citta}}, {{oggi}}`

const course = `Corso «{{corso.nome}}»{{corso.edizione_suffisso}} – ID corso {{corso.codice}} – CUP {{corso.cup}}
{{corso.finanziamento}}
Decreto {{corso.decreto}}`

const signature = `Il Legale Rappresentante
{{scuola.legale_rappresentante}}
(documento firmato digitalmente)`

export const courseStartBody = `${header}

OGGETTO: Comunicazione di avvio attività formativa

${course}

Il sottoscritto {{scuola.legale_rappresentante}}, in qualità di Legale Rappresentante di {{scuola.ragione_sociale}},

COMUNICA

l'avvio del corso in oggetto in data {{corso.data_inizio}}, con termine previsto il {{corso.data_fine}}, per una durata complessiva di {{corso.ore}} ore.

Si trasmettono in allegato:
- calendario delle lezioni;
- elenco degli allievi iscritti;
- elenco del personale impiegato (docenti, tutor, personale amministrativo);
- ______________________________________________

Sede di svolgimento: ______________________________ (modalità: in aula / FAD sincrona).

Restando a disposizione per ogni chiarimento, si porgono distinti saluti.

${signature}`

export const courseEndBody = `${header}

OGGETTO: Comunicazione di conclusione attività formativa

${course}

Il sottoscritto {{scuola.legale_rappresentante}}, in qualità di Legale Rappresentante di {{scuola.ragione_sociale}},

COMUNICA

che il corso in oggetto, avviato il {{corso.data_inizio}}, si è concluso in data {{corso.data_fine}} per complessive {{corso.ore}} ore.

Allievi avviati: ____ – allievi che hanno concluso il percorso: ____ – allievi idonei/attestati rilasciati: ____.

Si trasmette in allegato la documentazione richiesta per gli adempimenti conclusivi:
- registri / report delle presenze FAD;
- ______________________________________________

Distinti saluti.

${signature}`

export const reportCountersignBody = `${header}

OGGETTO: Trasmissione verbale di verifica controfirmato

${course}

Il sottoscritto {{scuola.legale_rappresentante}}, in qualità di Legale Rappresentante di {{scuola.ragione_sociale}},

con riferimento al verbale di verifica prot. n. __________ del __________, relativo al corso in oggetto,

TRASMETTE

il verbale debitamente controfirmato digitalmente per accettazione, caricato anche sul sistema Rendiconta Web, e si impegna a emettere la relativa nota di debito per l'importo riconosciuto.

Distinti saluti.

${signature}`

export const COURSE_START_TEMPLATE = 'Comunicazione di avvio corso (Regione)'
export const COURSE_END_TEMPLATE = 'Comunicazione di fine corso (Regione)'
export const REPORT_COUNTERSIGN_TEMPLATE = 'Trasmissione verbale controfirmato (Regione)'
