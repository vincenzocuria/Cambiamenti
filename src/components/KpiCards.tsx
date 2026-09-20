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

function cardClass(active?: boolean): string {
  return (
    'rounded-2xl border bg-white p-5 text-left shadow-sm transition ' +
    (active
      ? 'border-indigo-400 ring-2 ring-indigo-100'
      : 'border-slate-200 hover:border-indigo-300 hover:shadow')
  )
}

function CardBody({ item }: { item: KpiCardItem }) {
  return (
    <>
      <p className="text-sm font-medium text-slate-500">{item.label}</p>
      <p className={`mt-2 text-3xl font-bold ${toneValue[item.tone ?? 'default']}`}>{item.value}</p>
      {item.hint && <p className="mt-1 text-xs text-slate-400">{item.hint}</p>}
    </>
  )
}

export function KpiCards({ items, className = 'mb-5' }: { items: KpiCardItem[]; className?: string }) {
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
          <Link key={item.key} to={item.to} className={cardClass(item.active)}>
            <CardBody item={item} />
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={cardClass(item.active)}
          >
            <CardBody item={item} />
          </button>
        ),
      )}
    </div>
  )
}
