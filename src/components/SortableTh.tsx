import type { PersonSortKey, SortDirection } from '../lib/sortPeople'
import { thClass } from '../lib/tableStyles'

interface Props {
  label: string
  column: PersonSortKey
  activeKey: PersonSortKey
  direction: SortDirection
  onSort: (column: PersonSortKey) => void
}

export function SortableTh({ label, column, activeKey, direction, onSort }: Props) {
  const active = activeKey === column
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <th className={thClass} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`group inline-flex items-center gap-1 rounded font-medium text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? 'text-slate-800' : ''}`}
      >
        {label}
        <span
          className={`text-[10px] leading-none ${active ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'}`}
          aria-hidden
        >
          {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}
