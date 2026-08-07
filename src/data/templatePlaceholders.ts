/** Elenco placeholder disponibili nei template (`{{chiave}}`). */
export const templatePlaceholderGroups = [
  {
    title: 'Scuola',
    items: [
      'scuola.nome',
      'scuola.indirizzo',
      'scuola.piva',
      'scuola.rea',
      'scuola.email',
      'scuola.telefono',
      'scuola.sdi',
    ],
  },
  {
    title: 'Corso',
    items: [
      'corso.nome',
      'corso.edizione',
      'corso.codice',
      'corso.cup',
      'corso.stato',
      'corso.data_inizio',
      'corso.data_fine',
      'corso.ore',
      'corso.note',
    ],
  },
  {
    title: 'Persona',
    items: [
      'persona.nome',
      'persona.cognome',
      'persona.nome_completo',
      'persona.cf',
      'persona.indirizzo',
      'persona.citta',
      'persona.email',
      'persona.email_fad',
      'persona.password_fad',
      'persona.telefono',
      'persona.iban',
      'persona.banca',
    ],
  },
  {
    title: 'Alias per ruolo',
    items: [
      'docente.nome_completo',
      'docente.cf',
      'tutor.nome_completo',
      'tutor.cf',
      'amministrativo.nome_completo',
      'amministrativo.cf',
      'alunno.nome_completo',
      'alunno.cf',
    ],
  },
  {
    title: 'Date',
    items: ['oggi'],
  },
] as const
