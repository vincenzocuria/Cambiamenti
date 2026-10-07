import { fieldInputClass } from './Field'
import { SortField } from './SortField'
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
  documenti: 'Documenti',
  corso: 'Corso',
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
  /** `stack` tiene ricerca e ordinamento su due righe, nelle card strette. */
  layout?: 'row' | 'stack'
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
  layout = 'row',
}: Props) {
  const directionTitle = sortDir === 'asc' ? 'Ordine crescente' : 'Ordine decrescente'
  return (
    <div
      className={
        layout === 'stack'
          ? 'flex flex-col gap-2'
          : 'flex flex-col gap-2 sm:flex-row sm:items-center'
      }
    >
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        className={`${fieldInputClass} h-10 min-w-0 flex-1`}
      />
      <SortField
        value={sortKey}
        options={sortKeys.map((key) => ({ value: key, label: SORT_LABELS[key] }))}
        onChange={(value) => onSortKey(value as PersonSortKey)}
        directionLabel={sortDir === 'asc' ? 'A→Z' : 'Z→A'}
        directionTitle={directionTitle}
        onToggleDirection={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
      />
    </div>
  )
}
