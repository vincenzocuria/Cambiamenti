import type { EipassCandidate } from '../types/db'

export const eipassListStatuses = [
  'esame_fatto',
  'esame_da_fare',
  'documenti_ok',
  'documenti_mancanti',
] as const

export type EipassListStatus = (typeof eipassListStatuses)[number]

export function isEipassListStatus(value: string): value is EipassListStatus {
  return (eipassListStatuses as readonly string[]).includes(value)
}

export const eipassStatusLabels: Record<EipassListStatus, string> = {
  esame_fatto: 'Esame fatto',
  esame_da_fare: 'Esame da fare',
  documenti_ok: 'Documenti ok',
  documenti_mancanti: 'Documenti mancanti',
}

export function eipassExamLabel(candidate: Pick<EipassCandidate, 'exam_done'>): string {
  return candidate.exam_done ? 'Esame fatto' : 'Esame da fare'
}
