/** Trim e spazi multipli → uno solo. */
export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Codice formale: trim + maiuscolo senza spazi. */
export function upperCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/**
 * Title Case italiano: "MARIO ROSSI" / "mario rossi" → "Mario Rossi".
 * Gestisce trattini e apostrofi: "maria-luisa", "d'angelo" → "Maria-Luisa", "D'Angelo".
 */
export function titleCase(value: string): string {
  const cleaned = cleanText(value)
  if (!cleaned) return ''

  return cleaned
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => {
      if (part === '-' || /^\s+$/.test(part)) return part
      return capitalizeWord(part)
    })
    .join('')
}

function capitalizeWord(word: string): string {
  if (!word) return word
  const apostrophe = word.indexOf("'")
  if (apostrophe >= 0 && apostrophe < word.length - 1) {
    const before = word.slice(0, apostrophe + 1)
    const after = word.slice(apostrophe + 1)
    return before.charAt(0).toUpperCase() + before.slice(1) + after.charAt(0).toUpperCase() + after.slice(1)
  }
  return word.charAt(0).toUpperCase() + word.slice(1)
}
