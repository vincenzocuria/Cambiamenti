import { useCallback, useMemo, useState } from 'react'
import type { Person } from '../types/db'
import { matchesSearch } from '../lib/matchesSearch'
import {
  DEFAULT_PERSON_SORT,
  DEFAULT_SORT_DIRECTION,
  sortPeople,
  type PersonSortKey,
  type SortDirection,
} from '../lib/sortPeople'

export function filterBrowsePeople(
  people: Person[],
  search: string,
  sortKey: PersonSortKey,
  sortDir: SortDirection,
  extraHaystack?: (person: Person) => string,
): Person[] {
  const q = search.trim()
  const base = q
    ? people.filter((p) =>
        matchesSearch(
          `${p.first_name} ${p.last_name} ${p.tax_code} ${p.email} ${p.fad_email} ${extraHaystack?.(p) ?? ''}`,
          q,
        ),
      )
    : people
  return sortPeople(base, sortKey, sortDir)
}

export function usePeopleBrowseControls() {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<PersonSortKey>(DEFAULT_PERSON_SORT)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIRECTION)

  const browse = useCallback(
    (people: Person[], extraHaystack?: (person: Person) => string) =>
      filterBrowsePeople(people, search, sortKey, sortDir, extraHaystack),
    [search, sortKey, sortDir],
  )

  return {
    search,
    setSearch,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    browse,
  }
}

export function usePeopleBrowse(people: Person[]) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<PersonSortKey>(DEFAULT_PERSON_SORT)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIRECTION)

  const filtered = useMemo(
    () => filterBrowsePeople(people, search, sortKey, sortDir),
    [people, search, sortKey, sortDir],
  )

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
