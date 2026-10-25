import path from 'node:path'
import { loadEnvFile } from './loadEnvFile.mjs'

const FALLBACK_FROM = 'no-reply@vcuria.app'

/**
 * Chiave e mittente Resend di Cambia-Menti.
 * Fonte principale: file centrale Global Res (CAMBIAMENTI_RESEND_*).
 * Il mittente sul dominio cambiamentisrl.it si usa solo quando Resend lo dà
 * verificato; altrimenti resta no-reply@vcuria.app (stesso account, già verificato).
 */
export async function getResendConfig(root) {
  loadEnvFile(path.join(root, '..', 'Global Res', '.env'), [
    'CAMBIAMENTI_RESEND_API_KEY',
    'CAMBIAMENTI_RESEND_FROM_EMAIL',
  ])
  const apiKey = process.env.CAMBIAMENTI_RESEND_API_KEY?.trim()
  if (!apiKey) return null

  const wanted = process.env.CAMBIAMENTI_RESEND_FROM_EMAIL?.trim() || FALLBACK_FROM
  const domain = wanted.split('@')[1]
  let fromEmail = FALLBACK_FROM
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await res.json()
    const found = body?.data?.find((d) => d.name === domain)
    if (found?.status === 'verified') fromEmail = wanted
    else
      console.warn(
        `Dominio ${domain} non ancora verificato su Resend (${found?.status ?? 'assente'}): mittente ${FALLBACK_FROM}`,
      )
  } catch (err) {
    console.warn(`Controllo dominio Resend fallito (${err.message}): mittente ${FALLBACK_FROM}`)
  }
  return { apiKey, fromEmail }
}
