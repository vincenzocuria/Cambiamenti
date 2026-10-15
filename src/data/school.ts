/** Riferimenti ufficiali Cambia-Menti Formazione (UI e moduli). */
export const school = {
  name: 'Cambia-Menti Formazione',
  shortName: 'Cambia-Menti',
  /** Ragione sociale e legale rappresentante per lettere di incarico e dichiarazioni. */
  companyName: 'Cambia-Menti S.r.l.',
  legalRepresentative: 'Basile Giordano',
  city: 'Corigliano Rossano',
  address: 'C.da Cardame snc, Corigliano-Rossano',
  vatNumber: '03936190788',
  rea: 'CS-266834',
  email: 'cambiamenticalabria@gmail.com',
  phone: '+39 379 329 8942',
  sdiCode: 'KRRH6B9',
  /** Foro competente citato nella lettera di incarico. */
  court: 'Castrovillari',
  /** Dati cedente per la fattura elettronica (FatturaPA). */
  invoice: {
    /** Ragione sociale come registrata su Aruba Fatturazione Elettronica. */
    legalName: 'Cambia-Menti S.r.l.',
    street: 'C.da Cardame snc',
    postalCode: '87064',
    city: 'Corigliano-Rossano',
    province: 'CS',
    /** RF01 = regime ordinario. */
    taxRegime: 'RF01',
  },
  logoSrc: '/logo-cambia-menti.png',
} as const

export type SchoolInfo = typeof school
