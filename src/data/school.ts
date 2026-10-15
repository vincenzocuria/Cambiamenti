/** Riferimenti ufficiali Cambia-Menti Formazione (UI e moduli). */
export const school = {
  name: 'Cambia-Menti Formazione',
  shortName: 'Cambia-Menti',
  address: 'C.da Cardame snc, Corigliano-Rossano',
  vatNumber: '03936190788',
  rea: 'CS-266834',
  email: 'cambiamenticalabria@gmail.com',
  phone: '+39 379 329 8942',
  sdiCode: 'KRRH6B9',
  /** Dati cedente per la fattura elettronica (FatturaPA). */
  invoice: {
    legalName: 'Cambia-Menti Formazione',
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
