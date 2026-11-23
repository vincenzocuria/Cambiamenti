/** Modulo richiesto da FormAres (V finestra GOL, 23/11/2026): ogni iscritto lo firma prima dell'avvio. */
export const ENROLLMENT_DECLARATION_TEMPLATE = 'Dichiarazione disponibilità frequenza corso (GOL)'

const B = '____________________'

export const enrollmentDeclarationBody = `DICHIARAZIONE DISPONIBILITÀ FREQUENZA CORSO

{{alunno.sottoscritto|Il/La sottoscritto/a}} {{alunno.nome_completo|${B}}}, {{alunno.nato|nato/a}} a {{alunno.luogo_nascita|${B}}} (______) il {{alunno.data_nascita|____/____/________}}
Codice Fiscale {{alunno.cf|${B}}}   Cittadinanza ____________________
residente a {{alunno.citta|${B}}} ({{alunno.provincia|______}}) CAP {{alunno.cap|________}} in via/piazza {{alunno.via|${B}${B}}}
cell. {{alunno.telefono|${B}}}   E-mail {{alunno.email|${B}}}

In riferimento al Programma «Garanzia di Occupabilità dei Lavoratori – GOL» Piano Attuativo della Regione Calabria (PAR) (DGR n. 169 del 30 aprile 2022 e s.m.i.) V finestra per candidatura enti di formazione già accreditati al programma GOL – Avviso pubblico n. 2 GOL – Approvazione del Catalogo della V finestra – Decreto Dirigenziale {{corso.decreto}},

consapevole degli effetti penali per dichiarazioni mendaci, falsità in atti ed uso di atti falsi ai sensi degli artt. 46 e 47 del DPR 445/2000, sotto la propria responsabilità

DICHIARA

- la propria disponibilità a frequentare il corso {{corso.nome|${B}}} della durata di {{corso.ore|______}} ore;

- di essere in possesso di uno dei seguenti status di condizionalità (segnare con una x l'opzione o le opzioni a cui si fa riferimento):
{{alunno.check_sfl|☐}} PERCETTORE SFL
{{alunno.check_adi|☐}} PERCETTORE ADI
{{alunno.check_naspi|☐}} PERCETTORE NASPI
{{alunno.check_nessuno|☐}} NESSUNO

- di non aver acquisito una qualifica professionale (ovvero una qualifica professionale di 400 o 500 o 600 ore) in ambito Programma GOL;

- di essere stato/a informato/a sulle condizioni di partecipazione al corso e sull'erogazione dell'indennità di frequenza, corrispondente ad € 3,50 ad ora, a condizione della frequenza minima del 70% delle ore erogate.

Data ____/____/________

(Firma leggibile) _________________________________



CONSENSO AL TRATTAMENTO DEI DATI PERSONALI
REGOLAMENTO (UE) 2016/679 (GDPR)

{{alunno.sottoscritto|Il/La sottoscritto/a}} {{alunno.nome_completo|${B}}}, {{alunno.nato|nato/a}} a {{alunno.luogo_nascita|${B}}} (Prov. ____) il {{alunno.data_nascita|____/____/________}}, C.F. {{alunno.cf|${B}}}, in qualità di allievo dei corsi che saranno svolti dall'Ente Formativo CAMBIA-MENTI SRL con sede in CORIGLIANO ROSSANO (Prov. CS), VIA CONTRADA CARDAME SNC FRAZ. AREA URBANA DI CORIGLIANO – C.F. / P.IVA {{scuola.piva}}, in nome del suo legale rappresentante Sig. GIORDANO BASILE;

essendo stato/a informato/a:
- dell'identità del titolare del trattamento dei dati;
- dell'identità del Responsabile della protezione dei dati;
- della misura, modalità con le quali il trattamento avviene;
- delle finalità del trattamento cui sono destinati i dati personali;
- del diritto alla revoca del consenso.

Così come indicato dalle lettere a), b), c), d), e), f), g), dell'informativa alla quale il presente modulo è allegato, ai sensi dell'art. 13 del Regolamento (UE) 2016/679

ACCONSENTE

ai sensi e per gli effetti dell'art. 7 e ss. del Regolamento (UE) 2016/679, con la sottoscrizione del presente modulo, al trattamento dei dati personali secondo le modalità e nei limiti di cui all'informativa allegata ivi inclusi quelli considerati come categorie particolari di dati.

Letto, confermato e sottoscritto

Luogo e data _______________________________, ____/____/________

_________________________________



INFORMATIVA RIGUARDO AL TRATTAMENTO DEI DATI PERSONALI
(ART. 13 REG. UE 2016/679)

Gentile Allievo,
ai fini previsti dal Regolamento UE 2016/679 sopra richiamato (di seguito «G.D.P.R. 2016/679»), recante le nuove disposizioni a tutela della «privacy» e relativo alla protezione e al trattamento dei dati personali, si informa che il trattamento dei dati personali da Lei già forniti ed acquisiti e che da Lei saranno forniti in futuro in qualità di «interessato», saranno oggetto di trattamento nel rispetto della normativa prevista dal citato Regolamento e degli obblighi di riservatezza, correttezza, liceità e trasparenza.

a) Titolare del trattamento
Il titolare del trattamento è «CAMBIA-MENTI SRL» con sede in CORIGLIANO ROSSANO (Prov. CS), Via CONTRADA CARDAME SNC FRAZ. AREA URBANA DI CORIGLIANO – C.F. / P.IVA {{scuola.piva}} in nome del suo legale rappresentante Sig. GIORDANO BASILE;

b) Finalità del trattamento
I dati personali forniti sono necessari ai fini della collaborazione per la realizzazione dei Corsi Regionali.

c) Modalità di trattamento e conservazione
Il trattamento dei dati da Lei forniti è svolto sia in forma automatizzata sia in forma manuale nel rispetto di quanto previsto dall'art. 32 del G.D.P.R. 2016/679, ad opera di soggetti appositamente incaricati e in ottemperanza a quanto previsto dall'art. 29 del G.D.P.R. 2016/679. Le segnaliamo che, nel rispetto dei principi di liceità, limitazione delle finalità e minimizzazione dei dati, ai sensi dell'art. 5 del G.D.P.R. 2016/679, previo il Suo consenso libero ed esplicito espresso nell'allegato alla presente informativa, i suoi dati personali saranno conservati per il periodo di tempo necessario per il conseguimento delle finalità per le quali sono raccolti e trattati e comunque non oltre i termini stabiliti dalle normative fiscali, normative del lavoro e previdenziali e dal codice civile in materia e per ulteriori dieci anni.

d) Ambito di comunicazione e diffusione
La informiamo, inoltre, che i dati raccolti non saranno mai diffusi e non saranno oggetto di comunicazione senza il Suo esplicito consenso, salvo le comunicazioni necessarie che possono comportare il trasferimento di dati ad enti pubblici, a consulenti o ad altri soggetti per l'adempimento degli obblighi di legge. Inoltre, tali dati potranno essere conosciuti, nei limiti della normativa vigente, da dipendenti e/o collaboratori espressamente nominati ed incaricati dal Titolare.

e) Categorie particolari di dati personali
Ai sensi degli articoli 9 e 10 del G.D.P.R. 2016/679, Lei potrebbe conferire alla nostra organizzazione dati qualificabili come «categorie particolari di dati personali» e cioè quei dati che rivelano «l'origine razziale o etnica, le opinioni politiche, le convinzioni religiose o filosofiche, o l'appartenenza sindacale, nonché dati genetici, dati biometrici intesi a identificare in modo univoco una persona fisica, dati relativi alla salute o alla vita sessuale o all'orientamento sessuale della persona»; tali categorie di dati potranno essere trattate solo previo ed esplicito consenso, manifestato in forma scritta in allegato alla presente informativa.

f) Diritti dell'interessato
In relazione ai dati oggetto del trattamento di cui alla presente informativa all'interessato è riconosciuto in qualsiasi momento il diritto di:
- Accesso (art. 15 Regolamento UE n. 2016/679);
- Rettifica (art. 16 Regolamento UE n. 2016/679);
- Cancellazione (art. 17 Regolamento UE n. 2016/679);
- Limitazione (art. 18 Regolamento UE n. 2016/679);
- Portabilità, intesa come diritto ad ottenere dal titolare del trattamento i dati in un formato strutturato di uso comune e leggibile da dispositivo automatico per trasmetterli ad un altro titolare del trattamento senza impedimenti (art. 20 Regolamento UE n. 2016/679);
- Opposizione al trattamento (art. 21 Regolamento UE n. 2016/679);
- Revoca del consenso al trattamento, senza pregiudizio per la liceità del trattamento basata sul consenso acquisito prima della revoca (art. 7, par. 3 Regolamento UE n. 2016/679);
- Proporre reclamo all'Autorità Garante per la Protezione dei dati personali (art. 51 Regolamento UE n. 2016/679).

g) Esercizio dei diritti
L'esercizio dei diritti può essere esercitato mediante comunicazione scritta da inviare a mezzo PEC all'indirizzo: {{scuola.pec}} o lettera raccomandata a/r all'indirizzo: Via CONTRADA CARDAME SNC FRAZ. AREA URBANA DI CORIGLIANO – 87064 CORIGLIANO ROSSANO (CS).`
