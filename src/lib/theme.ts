/** Tema del gestionale: la scelta resta salvata nel browser. "auto" segue il sistema (chiaro o scuro). */
export type ThemeChoice = 'auto' | 'light' | 'soft' | 'dark'
export type AppliedTheme = Exclude<ThemeChoice, 'auto'>

export const THEME_KEY = 'cm.theme'
/** Evento nella stessa scheda quando cambia la scelta (lo "storage" arriva solo alle altre schede). */
export const THEME_EVENT = 'cm-theme-change'

export const themeOptions: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'auto', label: 'Automatico', hint: 'Segue il computer o il telefono' },
  { value: 'light', label: 'Chiaro', hint: 'Bianco, massimo contrasto' },
  { value: 'soft', label: 'Tenue', hint: 'Colori morbidi, riposa la vista' },
  { value: 'dark', label: 'Scuro', hint: 'Sfondo scuro, per la sera' },
]

const choices = new Set<string>(themeOptions.map((o) => o.value))

export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v && choices.has(v) ? (v as ThemeChoice) : 'auto'
  } catch {
    return 'auto'
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_KEY, choice)
  } catch {
    // archivio non disponibile: la scelta vale solo per questa visita
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): AppliedTheme {
  if (choice === 'auto') return prefersDark ? 'dark' : 'light'
  return choice
}

export function applyTheme(theme: AppliedTheme): void {
  document.documentElement.dataset.theme = theme
}
