type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={
        // Su telefono con 4+ voci: griglia 2×2, così nessuna voce esce dal riquadro.
        (options.length > 3 ? 'grid grid-cols-2 sm:flex' : 'flex') +
        ' w-full gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 sm:w-auto'
      }
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={
              'min-h-9 min-w-0 flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium break-words sm:flex-none ' +
              (active
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-800')
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
