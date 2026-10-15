/**
 * Dichiarazione sostitutiva del personale di corso (Allegato 2.1.b docenti, Mod. 3.1.b non docenti).
 * Usa le variabili `persona.*` così lo stesso testo vale per docenti, tutor e amministrativi.
 */
function staffDeclarationBody(heading: string, kind: 'DOCENTE' | 'NON DOCENTE'): string {
  return `${heading}

DICHIARAZIONE SOSTITUTIVA PERSONALE ${kind} INTERNO/ESTERNO - di CERTIFICAZIONE e/o di ATTO di NOTORIETÀ
(art. 19, 19 bis, 46, 47 D.P.R. 28 dicembre 2000 n. 445 e s.m.i.)

{{persona.sottoscritto}} {{persona.nome_completo}} Cod. Fisc. {{persona.cf}} {{persona.nato}} a {{persona.luogo_nascita}} il {{persona.data_nascita}}, residente in {{persona.indirizzo}}, con riferimento all'incarico affidato dall'Agenzia Formativa {{scuola.ragione_sociale}} per lo svolgimento di attività di formazione professionale - Convenzione/Decreto {{corso.decreto}} per il corso di "{{corso.nome}} - {{scuola.ragione_sociale}} - {{scuola.indirizzo}}" COD./ID N. {{corso.codice}} EDIZIONE {{corso.edizione}} - CUP {{corso.cup}}

consapevole delle sanzioni penali richiamate dall'art. 76 del D.P.R. 28/12/2000 n. 445 per false attestazioni, dichiarazioni non veritiere, e/o esibizione, formazione o uso di atti falsi, o contenenti dati non rispondenti a verità e della decadenza dei benefici eventualmente conseguenti al provvedimento emanato sulla base di dichiarazioni non veritiere, di cui all'art. 75 del D.P.R. 28/12/2000 n. 445; ai sensi e per gli effetti degli artt. 46 e 47 del citato D.P.R. 445/2000; sotto la propria responsabilità

DICHIARA

☐ di non avere attualmente in corso rapporti di dipendenza con la Pubblica Amministrazione;
☐ di avere attualmente in corso rapporti con la Pubblica Amministrazione e di essere stato/a autorizzato/a dalla predetta per l'attività corsuale (allegare copia autorizzazione).

{{scuola.citta}}, lì {{oggi}}

_____________________________
(firma leggibile del dichiarante)*

* Ai sensi dell'art. 38 D.P.R. 445/2000, la dichiarazione è sottoscritta dall'interessato in presenza del dipendente addetto ovvero sottoscritta o inviata insieme alla fotocopia di un documento d'identità, in corso di validità, del dichiarante, all'ufficio competente via fax, tramite un incaricato oppure a mezzo posta.`
}

export const allegato21bBody = staffDeclarationBody('Allegato 2.1.b', 'DOCENTE')

export const mod31bBody = staffDeclarationBody('Mod. 3.1.b', 'NON DOCENTE')
