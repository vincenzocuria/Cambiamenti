import { useMemo, useState } from 'react'
import type { Person } from '../types/db'
import { matchesSearch } from '../lib/matchesSearch'
import {
  DEFAULT_PERSON_SORT,
  DEFAULT_SORT_DIRECTION,
  sortPeople,
  type PersonSortKey,
  type SortDirection,
} from '../lib/sortPeople'

export function usePeopleBrowse(people: Person[]) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<PersonSortKey>(DEFAULT_PERSON_SORT)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIRECTION)

  const filtered = useMemo(() => {
    const q = search.trim()
    const base = q
      ? people.filter((p) =>
          matchesSearch(
            `${p.first_name} ${p.last_name} ${p.tax_code} ${p.email} ${p.fad_email}`,
            q,
          ),
        )
      : people
    return sortPeople(base, sortKey, sortDir)
  }, [people, search, sortKey, sortDir])

  return {
    search,
    setSearch,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    filtered,
  }
}
