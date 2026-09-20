/** Categorie trattamento/prestazione INPS (Allegato 1.c GOL). */
export const inpsBenefitOptions = [
  { value: 'naspi', label: 'NASpI' },
  { value: 'adi', label: 'ADI – Assegno di Inclusione' },
  { value: 'sfl', label: 'SFL – Supporto per la Formazione e il Lavoro' },
  { value: 'cig', label: 'CIG/CIGS/Dis-Coll' },
  { value: 'nessuno', label: 'Nessun trattamento' },
] as const

export type InpsBenefit = (typeof inpsBenefitOptions)[number]['value']

export function inpsBenefitLabel(value: string): string {
  return inpsBenefitOptions.find((o) => o.value === value)?.label ?? ''
}

/** Prestazione INPS attiva (esclude vuoto e «nessuno»). */
export function hasPaidInpsBenefit(value: string): boolean {
  return value === 'naspi' || value === 'adi' || value === 'sfl' || value === 'cig'
}

export function inpsBenefitCheck(value: string, option: InpsBenefit): string {
  return value === option ? '☑' : '☐'
}
