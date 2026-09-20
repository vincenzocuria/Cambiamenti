import { useEffect, useMemo, useState } from 'react'
import { LIST_PAGE_SIZE, paginate, totalPages } from '../lib/paginate'

/** Pagina locale: si resetta quando cambiano filtri, senza query extra. */
export function usePagedSlice<T>(items: T[], resetKey: string, pageSize = LIST_PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const pages = totalPages(items.length, pageSize)

  useEffect(() => {
    setPage(1)
  }, [resetKey])

  const safePage = Math.min(page, pages)
  const slice = useMemo(
    () => paginate(items, safePage, pageSize),
    [items, safePage, pageSize],
  )

  return { page: safePage, setPage, pages, slice, pageSize }
}
