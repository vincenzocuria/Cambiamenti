/** Username Moodle: credenziale FAD, altrimenti email anagrafica, sempre in minuscolo. */
export function moodleUsername(fadEmail: string, email: string): string {
  return (fadEmail.trim() || email.trim()).toLowerCase()
}

/** Email obbligatoria per creare l'utente. Lo username, se è un indirizzo, ha la precedenza. */
export function moodleAccountEmail(username: string, email: string): string {
  if (username.includes('@')) return username
  const anagrafica = email.trim().toLowerCase()
  return anagrafica.includes('@') ? anagrafica : ''
}
