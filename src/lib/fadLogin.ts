/** Pagina di login della piattaforma FAD (Moodle). */
export const FAD_LOGIN_URL = 'https://www.cambiamentisrl.it/fad/login/index.php'

/**
 * Login con lo username già nel campo.
 * Moodle accetta `?username=` e lascia vuota la password.
 */
export function fadLoginUrl(username?: string): string {
  const value = username?.trim()
  if (!value) return FAD_LOGIN_URL
  const url = new URL(FAD_LOGIN_URL)
  url.searchParams.set('username', value)
  return url.toString()
}
