import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { themeOptions, type ThemeChoice } from '../lib/theme'
import { NavIcon, type NavIconName } from './NavIcon'

const icons: Record<ThemeChoice, NavIconName> = {
  auto: 'themeAuto',
  light: 'themeLight',
  soft: 'themeSoft',
  dark: 'themeDark',
}

/** Pulsante tema (Automatico, Chiaro, Tenue, Scuro) con menu a tendina; `up` apre il menu verso l'alto. */
export function ThemeMenu({ up = false }: { up?: boolean }) {
  const { choice, applied, setChoice } = useTheme()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = themeOptions.find((o) => o.value === choice)!
  // Con "Automatico" l'icona mostra il tema in uso in quel momento.
  const buttonIcon = choice === 'auto' ? icons[applied] : icons[choice]

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        title={`Tema: ${current.label}`}
        aria-label={`Tema: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <NavIcon name={buttonIcon} className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Tema"
          className={`absolute z-50 w-60 ${up ? 'bottom-full left-1/2 mb-2 -translate-x-1/2' : 'right-0 top-full mt-2'} overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg`}
        >
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tema</p>
          {themeOptions.map((o) => {
            const selected = o.value === choice
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setChoice(o.value)
                  setOpen(false)
                }}
                className={
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ' +
                  (selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100')
                }
              >
                <NavIcon
                  name={icons[o.value]}
                  className={'h-5 w-5 shrink-0 ' + (selected ? 'text-indigo-600' : 'text-slate-400')}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className={'block text-xs ' + (selected ? 'text-indigo-600' : 'text-slate-500')}>
                    {o.hint}
                  </span>
                </span>
                {selected && <NavIcon name="check" className="h-4 w-4 shrink-0 text-indigo-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
