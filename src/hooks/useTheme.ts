import { useEffect, useState } from 'react'
import {
  applyTheme,
  readThemeChoice,
  resolveTheme,
  saveThemeChoice,
  systemPrefersDark,
  THEME_EVENT,
  type ThemeChoice,
} from '../lib/theme'

/** Scelta del tema; con "Automatico" segue anche i cambi del sistema mentre la pagina è aperta. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice)
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => setPrefersDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Gli altri selettori della pagina e le altre schede aperte si allineano alla stessa scelta.
  useEffect(() => {
    const sync = () => setChoice(readThemeChoice())
    window.addEventListener('storage', sync)
    window.addEventListener(THEME_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(THEME_EVENT, sync)
    }
  }, [])

  const applied = resolveTheme(choice, prefersDark)
  useEffect(() => applyTheme(applied), [applied])

  function change(next: ThemeChoice) {
    setChoice(next)
    saveThemeChoice(next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return { choice, applied, setChoice: change }
}
