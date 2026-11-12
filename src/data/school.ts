/** Riferimenti ufficiali Cambia-Menti Formazione (UI e moduli). */
export const school = {
  name: 'Cambia-Menti Formazione',
  shortName: 'Cambia-Menti',
  /** Ragione sociale e legale rappresentante per lettere di incarico e dichiarazioni. */
  companyName: 'Cambia-Menti S.r.l.',
  legalRepresentative: 'Basile Giordano',
  /** Dati del legale rappresentante per le comunicazioni alla Regione. */
  legalRepresentativeDetails: {
    name: 'GIORDANO BASILE',
    birthPlace: 'CORIGLIANO CALABRO',
    birthProvince: 'CS',
    birthDate: '27/09/1993',
    taxCode: 'BSLGDN93P27D005H',
  },
  taxCode: '03936190788',
  /** Sede legale e operativa come scritte nelle comunicazioni alla Regione. */
  officialSeat: 'via CARDAME, SNC, CAP 87064 CORIGLIANO ROSSANO (CS)',
  pec: 'cambiamentisrl@pec.it',
  /** Accreditamento regionale (DGR n. 335/2021). */
  accreditation: 'Decreto 7637 del 26/05/2025',
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
  logoSrc: '/logo-cambia-menti-trasparente.png',
} as const

export type SchoolInfo = typeof school
