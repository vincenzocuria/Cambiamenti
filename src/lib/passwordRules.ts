export const MIN_PASSWORD_LENGTH = 8

export function passwordError(password: string, confirm?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`
  }
  if (confirm != null && password !== confirm) return 'Le password non coincidono.'
  return null
}
