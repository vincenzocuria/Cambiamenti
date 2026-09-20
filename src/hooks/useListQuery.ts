import { useSearchParams } from 'react-router-dom'

/** Ricerca e filtro stato persistiti in query string (`q`, `stato`). */
export function useListQuery() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('stato') ?? ''

  function patch(next: { q?: string; stato?: string }) {
    setParams(
      (prev) => {
        const u = new URLSearchParams(prev)
        if ('q' in next) {
          const q = next.q?.trim() ?? ''
          if (q) u.set('q', q)
          else u.delete('q')
        }
        if ('stato' in next) {
          const s = next.stato ?? ''
          if (s && s !== 'tutti') u.set('stato', s)
          else u.delete('stato')
        }
        return u
      },
      { replace: true },
    )
  }

  return {
    search,
    status,
    setSearch: (q: string) => patch({ q }),
    setStatus: (stato: string) => patch({ stato }),
  }
}
