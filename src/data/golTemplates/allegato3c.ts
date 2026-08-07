/** Corpo template Allegato 3.c — Comunicazione modalità di pagamento. */
export const allegato3cBody = `Allegato 3.c - Modulo di comunicazione della modalità di pagamento

Ente di Formazione: {{scuola.nome}}
Sede: {{scuola.indirizzo}}
Contatti (tel./e-mail): {{scuola.telefono}} / {{scuola.email}}
Percorso formativo: “{{corso.nome}}”
CUP {{corso.cup}}
ID Corso/Edizione: {{corso.codice}}{{corso.edizione_suffisso}}

1. Premessa
Gentile destinatario/a,
in relazione alla Sua partecipazione al percorso formativo sopra indicato, La informiamo che, qualora maturi i requisiti di “allievo valido” (frequenza minima prevista e rilascio dell’Attestato di messa in trasparenza degli apprendimenti – Format A – o Attestato di messa in trasparenza delle competenze – Format B), Lei potrà avere diritto all’indennità di frequenza.
L’indennità è erogata dall’Ente esclusivamente con modalità tracciabili, nel rispetto della normativa vigente e delle disposizioni dell’Amministrazione/Regione.

2. Modalità di pagamento ammesse
Sono ammesse esclusivamente le seguenti modalità:
– Bonifico SEPA su IBAN intestato al destinatario;
– Bonifico SEPA su carta prepagata, solo se nominativa, intestata al destinatario (o al genitore/tutore in caso di minore), dotata di IBAN SEPA e abilitata alla ricezione di bonifici;
– Bonifico domiciliato, ove previsto e attivabile secondo le regole applicabili.

Non sono ammessi: contanti; assegni; carte prepagate non nominative; carte prepagate prive di IBAN; strumenti intestati a soggetti diversi dal beneficiario (salvo minori con rappresentanza legale); altre modalità non tracciabili.

3. Finalità della comunicazione
La comunicazione della modalità di pagamento prescelta e dei relativi dati è necessaria per consentire l’erogazione dell’indennità. L’IBAN deve essere comunicato esclusivamente in caso di scelta del bonifico bancario o postale.
Il conferimento dell’IBAN è necessario esclusivamente per: consentire l’accredito dell’eventuale indennità di frequenza spettante; rispettare gli obblighi di tracciabilità dei pagamenti; adempiere correttamente agli obblighi contabili e fiscali previsti.
In assenza di IBAN valido, l’Ente non potrà procedere all’erogazione dell’indennità eventualmente maturata (salvo bonifico domiciliato, se previsto).

4. Dati da compilare (a cura del destinatario)
Nome e Cognome: {{alunno.nome_completo}}
Nato/a a: {{alunno.luogo_nascita}} il {{alunno.data_nascita}}
Codice Fiscale: {{alunno.cf}}
Telefono / E-mail: {{alunno.telefono_email}}

5. Modalità di pagamento Prescelta:
{{alunno.check_bonifico_sepa}} Bonifico SEPA su IBAN intestato al destinatario
IBAN: {{alunno.iban}}
Intestatario del conto/carta: {{alunno.nome_completo}}
Istituto emittente (Banca/Poste): {{alunno.banca}}

Dichiaro che l’IBAN indicato:
è attivo e corretto;
è intestato a me (oppure al genitore/tutore in caso di minore);
in caso di carta prepagata, è nominativa e dotata di IBAN SEPA.

{{alunno.check_bonifico_domiciliato}} Bonifico Domiciliato

6. Caso destinatario minorenne (se applicabile)
(compilare a mano se il partecipante è minorenne)

7. Dichiarazione di consapevolezza e di responsabilità
Il/La sottoscritto/a dichiara di essere consapevole che:
l’IBAN è richiesto unicamente per consentire il pagamento dell’indennità di frequenza eventualmente spettante;
l’erogazione dell’indennità avverrà solo in presenza dei requisiti previsti e nei tempi conseguenti al pagamento ricevuto dall’Ente dall’Amministrazione/Regione;
l’eventuale mancata comunicazione di un IBAN valido può comportare l’impossibilità di procedere al pagamento;
l’indennità non costituisce rapporto di lavoro ed è soggetta al trattamento fiscale eventualmente applicabile secondo la normativa vigente.

8. Informativa sintetica sul trattamento dei dati (Privacy)
I dati personali contenuti nella presente dichiarazione saranno trattati esclusivamente per le finalità amministrative, contabili, fiscali, di rendicontazione, controllo e pagamento connesse all’attuazione dell’intervento, nel rispetto del Regolamento (UE) 2016/679 e della normativa nazionale vigente in materia di protezione dei dati personali.
Il/La sottoscritto/a dichiara di aver ricevuto o preso visione dell’informativa sul trattamento dei dati personali resa dall’Ente di formazione ai sensi della normativa vigente.

Luogo e data {{oggi}}
Firma del destinatario maggiorenne
(oppure del genitore/tutore in caso di minore)
__________________________________`
