const controlClass =
  'h-10 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 shadow-sm ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

type Option = { value: string; label: string }

type Props = {
  value: string
  options: Option[]
  onChange: (value: string) => void
  directionLabel: string
  directionTitle: string
  onToggleDirection: () => void
}

export function SortField({
  value,
  options,
  onChange,
  directionLabel,
  directionTitle,
  onToggleDirection,
}: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-slate-500">Ordina per</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} min-w-0 flex-1 px-3 sm:w-44 sm:flex-none`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onToggleDirection}
        title={directionTitle}
        aria-label={directionTitle}
        className={`${controlClass} shrink-0 px-3 font-medium text-slate-600 hover:bg-slate-50`}
      >
        {directionLabel}
      </button>
    </div>
  )
}
