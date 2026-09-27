import { useSearchParams } from 'react-router-dom'
import {
  DEFAULT_PERSON_SORT,
  DEFAULT_SORT_DIRECTION,
  isPersonSortKey,
  isSortDirection,
  type PersonSortKey,
  type SortDirection,
} from '../lib/sortPeople'

/** Ordinamento tabella in query string (`ord`, `dir`). */
export function useTableSort(
  defaultKey: PersonSortKey = DEFAULT_PERSON_SORT,
  defaultDir: SortDirection = DEFAULT_SORT_DIRECTION,
) {
  const [params, setParams] = useSearchParams()
  const rawOrd = params.get('ord') ?? ''
  const rawDir = params.get('dir') ?? ''
  const sortKey = isPersonSortKey(rawOrd) ? rawOrd : defaultKey
  const sortDir = isSortDirection(rawDir) ? rawDir : defaultDir

  function setSort(key: PersonSortKey, dir: SortDirection) {
    setParams(
      (prev) => {
        const u = new URLSearchParams(prev)
        const isDefault = key === defaultKey && dir === defaultDir
        if (isDefault) {
          u.delete('ord')
          u.delete('dir')
        } else {
          u.set('ord', key)
          u.set('dir', dir)
        }
        return u
      },
      { replace: true },
    )
  }

  function toggleSort(key: PersonSortKey) {
    if (sortKey === key) {
      setSort(key, sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(key, 'asc')
    }
  }

  return { sortKey, sortDir, toggleSort }
}
