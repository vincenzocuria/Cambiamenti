import { Link } from 'react-router-dom'

export interface KpiCardItem {
  key: string
  label: string
  value: number | string
  hint?: string
  to?: string
  active?: boolean
  onClick?: () => void
  tone?: 'default' | 'ok' | 'warn'
}

const toneValue: Record<NonNullable<KpiCardItem['tone']>, string> = {
  default: 'text-indigo-700',
  ok: 'text-emerald-700',
  warn: 'text-amber-800',
}

function cardClass(active?: boolean, compact?: boolean): string {
  return (
    `rounded-2xl border bg-white ${compact ? 'p-4' : 'p-5'} min-w-0 text-left shadow-sm transition ` +
    (active
      ? 'border-indigo-400 ring-2 ring-indigo-100'
      : 'border-slate-200 hover:border-indigo-300 hover:shadow')
  )
}

function CardBody({ item, compact }: { item: KpiCardItem; compact?: boolean }) {
  return (
    <>
      <p className="truncate text-sm font-medium text-slate-500">{item.label}</p>
      <p
        className={`${compact ? 'mt-1 truncate text-2xl' : 'mt-2 text-3xl'} font-bold tabular-nums ${toneValue[item.tone ?? 'default']}`}
      >
        {item.value}
      </p>
      {item.hint && (
        <p className={`mt-1 text-xs text-slate-400 ${compact ? 'line-clamp-2' : ''}`}>{item.hint}</p>
      )}
    </>
  )
}

export function KpiCards({
  items,
  className = 'mb-5',
  compact = false,
}: {
  items: KpiCardItem[]
  className?: string
  /** Card più basse e valori più piccoli (es. importi in euro). */
  compact?: boolean
}) {
  const cols =
    items.length >= 6
      ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
      : items.length === 5
        ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
        : 'grid-cols-2 lg:grid-cols-4'

  return (
    <div className={`grid gap-4 ${cols} ${className}`}>
      {items.map((item) =>
        item.to ? (
          <Link key={item.key} to={item.to} className={cardClass(item.active, compact)}>
            <CardBody item={item} compact={compact} />
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={cardClass(item.active, compact)}
          >
            <CardBody item={item} compact={compact} />
          </button>
        ),
      )}
    </div>
  )
}
