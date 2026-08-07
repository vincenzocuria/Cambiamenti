import type { Profile } from '../types/db'

/** Separa utenti in attesa dagli altri, entrambi ordinati per data. */
export function splitPendingProfiles(profiles: Profile[]): {
  pending: Profile[]
  others: Profile[]
} {
  const pending: Profile[] = []
  const others: Profile[] = []
  for (const p of profiles) {
    if (p.role === 'pending') pending.push(p)
    else others.push(p)
  }
  return { pending, others }
}
