// Utilità crittografiche (Web Crypto, nessuna dipendenza).

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomHex(bytes: number): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64ToBytes(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length, 1)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  return timingSafeEqual(enc.encode(a), enc.encode(b))
}

/** PKCE S256 (RFC 7636). */
export async function pkceMatches(verifier: string, challenge: string): Promise<boolean> {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  return safeEqual(bytesToBase64Url(digest), challenge)
}

// ---------------------------------------------------------------- cifratura token

const keyCache = new Map<string, Promise<CryptoKey>>()

function importKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret)
  if (!key) {
    const raw = base64ToBytes(secret)
    if (raw.length !== 32) throw new Error('CAMBIAMENTI_MCP_TOKEN_KEY deve essere di 32 byte (base64)')
    key = crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt'])
    keyCache.set(secret, key)
  }
  return key
}

/** Cifra con AES-256-GCM. Formato: v1.<iv base64url>.<ciphertext base64url> */
export async function encryptText(secret: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    await importKey(secret),
    new TextEncoder().encode(plaintext),
  )
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(data))}`
}

export async function decryptText(secret: string, payload: string): Promise<string> {
  const [version, ivPart, dataPart] = payload.split('.')
  if (version !== 'v1' || !ivPart || !dataPart) throw new Error('Token cifrato non valido')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivPart) as BufferSource },
    await importKey(secret),
    base64ToBytes(dataPart) as BufferSource,
  )
  return new TextDecoder().decode(plain)
}
