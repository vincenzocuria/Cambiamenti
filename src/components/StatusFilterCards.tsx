export interface StatusFilterItem {
  key: string
  label: string
  count: number
  tone?: 'default' | 'ok' | 'warn' | 'info'
}

const toneClass: Record<NonNullable<StatusFilterItem['tone']>, string> = {
  default: 'text-slate-800',
  ok: 'text-emerald-700',
  warn: 'text-amber-800',
  info: 'text-indigo-700',
}

interface Props {
  items: StatusFilterItem[]
  value: string
  onChange: (key: string) => void
  allCount: number
  allLabel?: string
}

export function StatusFilterCards({
  items,
  value,
  onChange,
  allCount,
  allLabel = 'Tutti',
}: Props) {
  const cards: StatusFilterItem[] = [{ key: '', label: allLabel, count: allCount }, ...items]

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {cards.map((item) => {
        const active = value === item.key
        return (
          <button
            key={item.key || 'tutti'}
            type="button"
            onClick={() => onChange(active && item.key ? '' : item.key)}
            className={
              'min-w-[7.5rem] rounded-xl border px-3 py-2 text-left shadow-sm transition ' +
              (active
                ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100'
                : 'border-slate-200 bg-white hover:border-indigo-300')
            }
          >
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className={`text-lg font-bold tabular-nums ${toneClass[item.tone ?? 'default']}`}>
              {item.count}
            </p>
          </button>
        )
      })}
    </div>
  )
}
