/**
 * Contratto di collaborazione coordinata e continuativa del personale interno
 * (tutor, direzione, amministrazione), dal modello firmato per il periodo 1/11/2025–31/12/2026.
 * Le variabili {{contratto.*}} vengono dalla scheda «Contratti di collaborazione» della persona.
 */
export const cococoContractBody = `CONTRATTO DI COLLABORAZIONE COORDINATA E CONTINUATIVA

per l'attività di {{contratto.attivita_titolo}} di corsi di formazione professionale

Tra

{{scuola.ragione_sociale}}, con sede legale in {{scuola.indirizzo}}, C.F./P.IVA {{scuola.piva}}, in persona del legale rappresentante pro tempore {{scuola.legale_rappresentante}}, di seguito denominato/a "Committente";

e

{{persona.nome_completo}}, {{persona.nato}} a {{persona.luogo_nascita}} il {{persona.data_nascita}}, residente in {{persona.indirizzo}}, C.F. {{persona.cf}}, di seguito denominato/a "Collaboratore";

di seguito, congiuntamente, le "Parti";

Premesso che

• il Committente organizza ed eroga corsi di formazione professionale rivolti a disoccupati/lavoratori/studenti;
• per lo svolgimento di tali attività il Committente necessita della collaborazione di una figura professionale di tutor didattico/d'aula, con competenze specifiche nel settore della formazione;
• il Collaboratore possiede la professionalità, l'esperienza e i requisiti necessari per lo svolgimento dell'incarico, come da curriculum vitae depositato agli atti e che le Parti dichiarano di ben conoscere;
• le Parti intendono regolare il rapporto di collaborazione con le modalità della collaborazione coordinata e continuativa di cui all'art. 409, n. 3, c.p.c., con prestazione svolta in autonomia quanto a modalità di esecuzione, nel rispetto del coordinamento con l'organizzazione del Committente;

Tutto ciò premesso, si conviene e si stipula quanto segue

Art. 1 – Premesse e allegati
Le premesse e gli eventuali allegati costituiscono parte integrante e sostanziale del presente contratto.

Art. 2 – Oggetto dell'incarico
Il Committente conferisce al Collaboratore, che accetta, l'incarico di svolgere le attività di {{contratto.attivita_oggetto}} dei corsi di formazione professionale organizzati dal Committente, con particolare riferimento a:

{{contratto.attivita}}

L'incarico riguarda in particolare i seguenti corsi: {{contratto.corsi}}, da svolgersi presso {{contratto.sede}}.

Resta inteso che le attività di direzione e amministrazione sono svolte dal Collaboratore in autonomia organizzativa, nel rispetto degli indirizzi generali, delle procedure e dei vincoli di progetto stabiliti dal Committente e/o dall'Ente finanziatore, senza che ciò configuri potere di rappresentanza legale del Committente verso terzi, salvo specifica e distinta procura scritta.

Art. 3 – Natura del rapporto
Il rapporto instaurato con il presente contratto ha natura di collaborazione coordinata e continuativa ai sensi dell'art. 409, n. 3, c.p.c. e dell'art. 2, comma 2, del D.Lgs. 15 giugno 2015, n. 81, e non costituisce in alcun modo rapporto di lavoro subordinato.
Il Collaboratore svolge la propria prestazione in piena autonomia in ordine alle modalità di esecuzione della stessa, pur coordinandosi con le esigenze organizzative e di calendario del Committente e con il progetto formativo di riferimento, senza vincoli di orario fissi né di subordinazione gerarchica, fermo restando il necessario coordinamento temporale con il calendario delle attività didattiche.
Il Collaboratore non è tenuto ad osservare un orario di lavoro predeterminato, potendo organizzare la propria attività compatibilmente con il calendario dei corsi e le esigenze di coordinamento con il Committente e con i docenti.

Art. 4 – Durata
Il presente contratto decorre dal {{contratto.data_inizio}} e avrà termine il {{contratto.data_fine}}, salvo proroga da concordarsi per iscritto tra le Parti, in relazione alla durata effettiva del/i corso/i di formazione oggetto dell'incarico.

Art. 5 – Corrispettivo
Per l'attività oggetto del presente contratto, al Collaboratore è riconosciuto un corrispettivo lordo pari a € {{contratto.compenso}} ({{contratto.compenso_lettere}}), da corrispondersi con le seguenti modalità: {{contratto.pagamento}}.
Il corrispettivo si intende comprensivo di ogni onere relativo allo svolgimento della prestazione, fatti salvi gli oneri previdenziali, assistenziali e fiscali previsti dalla normativa vigente, che saranno applicati secondo le regole proprie del rapporto (gestione separata INPS ex L. 335/1995, ritenuta d'acconto/IVA a seconda del regime fiscale del Collaboratore).
Eventuali rimborsi per spese documentate e preventivamente autorizzate dal Committente (es. trasferte presso sedi diverse da quella principale) saranno riconosciuti separatamente, dietro presentazione dei relativi giustificativi.

Art. 6 – Obblighi del Collaboratore
• svolgere l'incarico con diligenza professionale, nel rispetto del progetto formativo, dei regolamenti dell'Ente finanziatore (ove presente) e delle indicazioni organizzative del Committente;
• garantire la propria presenza secondo il calendario concordato con il Committente, comunicando tempestivamente eventuali impedimenti;
• assicurare la corretta e tempestiva tenuta della documentazione amministrativa e di rendicontazione del corso, secondo le tempistiche e le modalità richieste dal Committente e/o dall'Ente finanziatore;
• informare tempestivamente il Committente in merito a criticità didattiche, organizzative o amministrative rilevate nello svolgimento del corso;
• mantenere la riservatezza sui dati e le informazioni di cui venga a conoscenza nello svolgimento dell'incarico, con particolare riferimento ai dati personali dei partecipanti ai corsi;
• non utilizzare, per finalità estranee all'incarico, materiali, metodologie e documentazione messi a disposizione dal Committente.

Art. 7 – Obblighi del Committente
• fornire al Collaboratore le informazioni, i materiali e gli strumenti necessari allo svolgimento dell'incarico;
• corrispondere il compenso pattuito nei termini concordati;
• garantire il rispetto della normativa in materia di sicurezza sui luoghi di svolgimento dell'attività, ai sensi del D.Lgs. 81/2008, per quanto applicabile ai collaboratori coordinati e continuativi.

Art. 8 – Assenza di vincolo di subordinazione ed esclusività
Il presente contratto non comporta vincolo di esclusiva. Il Collaboratore può pertanto svolgere la propria attività professionale anche a favore di altri committenti, purché ciò non pregiudichi il regolare svolgimento dell'incarico oggetto del presente contratto e non determini situazioni di conflitto di interesse con il Committente.

Art. 9 – Recesso
Ciascuna delle Parti può recedere dal presente contratto prima della scadenza per giusta causa, con effetto immediato, ovvero per giustificato motivo, con un preavviso scritto di almeno {{contratto.preavviso}} giorni, da comunicarsi a mezzo PEC/raccomandata a.r./altro mezzo idoneo a garantirne la ricezione.
In caso di recesso, al Collaboratore spetterà il corrispettivo maturato per l'attività effettivamente svolta fino alla data di cessazione del rapporto.

Art. 10 – Trattamento dei dati personali
Ai sensi del Regolamento (UE) 2016/679 (GDPR) e del D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018, i dati personali del Collaboratore saranno trattati dal Committente esclusivamente per le finalità connesse alla gestione del presente contratto, con le modalità indicate nell'informativa allegata (Allegato A).
Il Collaboratore, nello svolgimento dell'incarico, tratterà i dati personali dei partecipanti ai corsi in qualità di {{contratto.ruolo_privacy}}, attenendosi alle istruzioni impartite dal Committente.

Art. 11 – Proprietà intellettuale
I materiali didattici, i contenuti e la documentazione eventualmente predisposti dal Collaboratore nell'ambito dell'incarico restano di proprietà del Committente, salvo diverso accordo scritto tra le Parti.

Art. 12 – Foro competente
Per qualsiasi controversia relativa all'interpretazione, esecuzione o risoluzione del presente contratto sarà competente in via esclusiva il Foro di {{scuola.foro}}, fatte salve le disposizioni inderogabili di legge in materia di competenza territoriale per le controversie di lavoro.

Art. 13 – Disposizioni finali
Per quanto non espressamente previsto dal presente contratto, si rinvia alle disposizioni del Codice Civile e delle leggi speciali in materia di collaborazioni coordinate e continuative.
Il presente contratto potrà essere modificato solo con atto scritto sottoscritto da entrambe le Parti.
Il presente contratto è soggetto a registrazione solo in caso d'uso, ai sensi del D.P.R. 131/1986, con oneri a carico della parte richiedente.

Letto, confermato e sottoscritto.

Luogo e data: {{scuola.citta}}, {{contratto.data_firma}}

Il Committente                                        Il Collaboratore
_____________________________                         _____________________________

Ai sensi degli artt. 1341 e 1342 c.c., le Parti dichiarano di approvare specificamente le clausole di cui agli articoli 3 (Natura del rapporto), 8 (Assenza di vincolo di subordinazione ed esclusività), 9 (Recesso) e 12 (Foro competente).

Il Committente                                        Il Collaboratore
_____________________________                         _____________________________`
