const units = [
  '', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci',
  'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove',
]
const tens = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta']

function below100(n: number): string {
  if (n < 20) return units[n]
  const t = tens[Math.floor(n / 10)]
  const u = n % 10
  // venti + uno → ventuno, trenta + otto → trentotto
  return (u === 1 || u === 8 ? t.slice(0, -1) : t) + units[u]
}

function below1000(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  const head = h === 0 ? '' : h === 1 ? 'cento' : `${units[h]}cento`
  // cento + ottanta → centottanta
  const tail = below100(rest)
  return head && tail.startsWith('o') ? head.slice(0, -1) + tail : head + tail
}

/** Intero in lettere (italiano), es. 2000 → "duemila". */
export function numberInWords(value: number): string {
  const n = Math.floor(Math.abs(value))
  if (n === 0) return 'zero'
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  let out = ''
  if (millions) out += millions === 1 ? 'unmilione' : `${below1000(millions)}milioni`
  if (thousands) out += thousands === 1 ? 'mille' : `${below1000(thousands)}mila`
  out += below1000(rest)
  return out
}

/** Importo in lettere come nei contratti: 2000 → "DUEMILA,00". */
export function euroInWords(value: number): string {
  const cents = Math.round(Math.abs(value) * 100) % 100
  return `${numberInWords(value).toUpperCase()},${String(cents).padStart(2, '0')}`
}

/** Importo in cifre: 2000 → "2.000,00". */
export function formatEuro(value: number): string {
  // it-IT non separa le migliaia sotto 10.000: formatto a mano
  const [int, dec] = Math.abs(value).toFixed(2).split('.')
  return `${value < 0 ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
}
