/**
 * Corpo template Lettera di incarico docente.
 * Moduli, ore e compensi cambiano per ogni incarico: restano righe da compilare a mano.
 */
export const teacherAppointmentBody = `LETTERA DI INCARICO PROFESSIONALE

Tra

l'Ente {{scuola.ragione_sociale}}, con sede in {{scuola.indirizzo}}, Partita IVA {{scuola.piva}}, nella persona del Legale Rappresentante, Sig. {{scuola.legale_rappresentante}},
di seguito indicato come «Committente»

e

{{docente.nome_completo}}, nato/a a {{docente.luogo_nascita}} il {{docente.data_nascita}} e residente in {{docente.indirizzo}}, C.F. {{docente.cf}},
di seguito indicato come «Collaboratore»,

congiuntamente denominati anche «le Parti».

PREMESSO CHE

l'Ente {{scuola.ragione_sociale}} attua il corso «{{corso.nome}}» Ed. {{corso.edizione}} - ID Catalogo Corso {{corso.codice}} - Codice CUP {{corso.cup}}, finanziato dalla Regione Calabria nell'ambito del Programma Garanzia Occupabilità dei Lavoratori (GOL) - Piano Nazionale di Ripresa e Resilienza (PNRR) Missione 5 «Inclusione e coesione» - Componente 1 «Politiche per il Lavoro» - Riforma 1.1 «Politiche Attive del Lavoro e Formazione» - Avviso n. 4 GOL, approvato con Decreto Dirigenziale n. 12595 del 08/09/2025.

Si conviene e si stipula quanto segue:

1) Con il presente atto le Parti intendono, ai sensi della vigente normativa in materia, instaurare un rapporto di lavoro di collaborazione, di alta professionalità, senza vincolo di subordinazione, avente per oggetto una prestazione d'opera ai sensi dell'art. 2222 del Codice Civile e dell'art. 409 del Codice di Procedura Civile.

2) Il Collaboratore sarà coinvolto nelle attività del Committente inerenti le attività di Docenza per i seguenti moduli: ______________________________________________________________
per n. ______ ore. Il compenso per ogni ora di corso è stabilito in € ________.

3) L'attività professionale oggetto del presente incarico dovrà essere svolta dal Collaboratore secondo le modalità stabilite dal Committente e contenute negli obblighi docenti. Il presente incarico avrà durata dalla data odierna fino al termine delle attività didattiche.

4) La prestazione dovrà essere eseguita personalmente dall'incaricato nei luoghi e negli orari stabiliti dall'ente {{scuola.ragione_sociale}}, comunicati tramite calendario didattico.

5) Nell'esecuzione delle attività previste il Collaboratore agirà in assoluta autonomia, salvo il necessario coordinamento con i responsabili delle diverse aree, nonché con gli altri collaboratori, per quanto strettamente necessario alla realizzazione delle attività oggetto della collaborazione nell'ambito dei progetti menzionati nel presente contratto.

6) Nell'esecuzione delle attività previste, il Collaboratore avrà piena facoltà di autodeterminarsi le fasi e le modalità di esercizio del proprio apporto professionale e di lavoro. Rimane escluso l'obbligo del Collaboratore di rispettare gli orari di lavoro stabiliti per i lavoratori dipendenti nonché l'onere di dover giustificare le assenze. Il Collaboratore potrà aver accesso, negli orari di apertura, ai locali della Sede del Committente sita in {{scuola.indirizzo}}. Ai soli fini del rispetto della normativa vigente in materia di sicurezza ex D.Lgs. n. 81/2008, il Collaboratore segnalerà la propria presenza e i relativi orari di permanenza al personale di accoglienza e segreteria delle strutture dove si recherà per espletare i contributi richiesti dalla presente collaborazione.

7) Il compenso pattuito per la realizzazione delle attività previste dagli articoli precedenti è fissato in € ____________ lordi (euro ______________________).

8) Detto compenso sarà sottoposto alle ritenute fiscali e previdenziali a norma di Legge vigenti.

9) Il Collaboratore, salvo che non risulti già iscritto, dovrà provvedere direttamente all'iscrizione alla gestione separata INPS per via telematica, entro trenta giorni dall'inizio del progetto, tramite il portale www.inps.it o il contact center dell'istituto (numero verde 803.164). Inoltre, sarà cura dello stesso fornire tempestiva comunicazione per ogni variazione che lo riguardi e che incida sul trattamento contributivo e assistenziale dei suoi compensi. In particolare, in relazione agli obblighi previsti a carico del committente dalla legge n. 335 del 1995 ed alle disposizioni contenute nella circolare INPS n. 34 del 07/02/1998, il Collaboratore dichiara (barrare la casella interessata):
☐ di essere iscritto ad una diversa gestione contributiva obbligatoria;
☐ di non essere iscritto ad una diversa gestione contributiva obbligatoria;
☐ di essere titolare di un trattamento pensionistico.

10) Il Collaboratore si impegna a non svolgere attività in concorrenza con quelle del committente, né diffondere notizie attinenti i programmi di sviluppo.

11) Costituisce clausola risolutiva espressa del presente atto:
- la mancata prestazione dell'attività richiesta dal Committente al Collaboratore secondo i programmi concordati;
- la violazione degli obblighi di correttezza e di segretezza;
- l'esecuzione negligente dell'incarico dalla quale sia derivato nocumento morale e materiale all'attività della associazione.
Inoltre, il Committente si riserva a proprio insindacabile giudizio:
- di interrompere l'incarico in qualsiasi momento, corrispondendo un compenso proporzionale al lavoro effettivamente svolto;
- di revocare l'incarico in caso di mancato puntuale adempimento delle prestazioni, ovvero nel caso in cui vengano meno i requisiti necessari alla costituzione del presente atto (nel caso di revoca, il rapporto si intende risolto "ipso iure" e di conseguenza viene meno l'obbligo di corrispondere gli importi sopra indicati).

12) Il presente incarico perderà ogni effetto qualora la Regione Calabria per qualsiasi motivo dovesse provvedere a risolvere la convenzione con il Committente e di conseguenza revocare il contributo, senza che da parte del professionista ci sia la possibilità di rivalersi economicamente sul Committente a qualsiasi titolo (mancato guadagno). Qualora il Collaboratore receda dal contratto prima dello svolgimento di tutte le ore previste, saranno corrisposte solo le ore effettivamente svolte.

13) Ferma restando la durata del contratto prestabilita al punto 3), e quanto stabilito al punto 11) in materia di clausola risolutiva espressa, le parti potranno comunque recedere prima della scadenza del termine, dando in quest'ultimo caso un preavviso scritto di almeno 15 giorni.

14) Il Committente come sopra indicato comunica al Collaboratore le misure per la tutela della salute e della sicurezza di cui al D.Lgs. n. 81/2008.

15) Per ogni controversia sarà competente il Foro di Castrovillari.

{{scuola.citta}}, {{oggi}}

Per il Committente - Il Legale Rappresentante
Firma: _____________________________

Per benestare ed accettazione - Il Collaboratore
Firma: _____________________________


CONSENSO DELL'INTERESSATO

Il/La sottoscritto/a {{docente.nome_completo}}, a seguito di consultazione e presa visione dell'informativa privacy ed essendo quindi stato/a informato/a in merito alla identità del titolare del trattamento, dell'identità del Responsabile della Protezione dei Dati, delle modalità con cui i miei dati vengono trattati, delle finalità del trattamento cui sono destinati i miei dati personali ai sensi dell'art. 13 del Regolamento UE 2016/679, con la presente acconsento al trattamento dei miei dati personali da parte dell'Ente {{scuola.ragione_sociale}} per le finalità strettamente connesse allo svolgimento dei servizi richiesti quali l'erogazione del corso nonché al fine di garantire il corretto espletamento delle procedure amministrative, istituzionali e di permettere all'ente {{scuola.ragione_sociale}} di garantire il più efficiente sfruttamento dei servizi formativi, il mantenimento delle specifiche funzionalità e prerogative didattiche.
Sono consapevole e sono stato/a informato/a del fatto di poter revocare il consenso in qualunque momento utilizzando il modulo di recesso dell'interessato e inviandolo per email all'indirizzo {{scuola.email}}.

{{scuola.citta}}, {{oggi}}

Il Collaboratore
Firma: _____________________________`
