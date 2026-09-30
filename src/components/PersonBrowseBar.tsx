import { fieldInputClass } from './Field'
import {
  personSortKeys,
  type PersonSortKey,
  type SortDirection,
} from '../lib/sortPeople'

const SORT_LABELS: Record<PersonSortKey, string> = {
  name: 'Nome',
  tax_code: 'Codice fiscale',
  birth_date: 'Data di nascita',
  email: 'Email',
  fad: 'FAD',
  phone: 'Telefono',
  city: 'Città',
  inps: 'INPS',
}

type Props = {
  search: string
  onSearch: (value: string) => void
  sortKey: PersonSortKey
  sortDir: SortDirection
  onSortKey: (key: PersonSortKey) => void
  onSortDir: (dir: SortDirection) => void
  placeholder?: string
  /** Nasconde colonne non rilevanti (es. INPS fuori dagli alunni). */
  sortKeys?: PersonSortKey[]
}

export function PersonBrowseBar({
  search,
  onSearch,
  sortKey,
  sortDir,
  onSortKey,
  onSortDir,
  placeholder = 'Cerca per nome, codice fiscale o email…',
  sortKeys = [...personSortKeys],
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        className={`${fieldInputClass} min-w-[12rem] flex-1`}
      />
      <label className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className="whitespace-nowrap">Ordina per</span>
        <select
          value={sortKey}
          onChange={(e) => onSortKey(e.target.value as PersonSortKey)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none"
        >
          {sortKeys.map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'}
          aria-label={sortDir === 'asc' ? 'Ordine crescente' : 'Ordine decrescente'}
        >
          {sortDir === 'asc' ? 'A→Z' : 'Z→A'}
        </button>
      </label>
    </div>
  )
}
