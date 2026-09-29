import { useEffect, useMemo, useState } from 'react'
import type { Person } from '../types/db'
import { fullName } from '../lib/format'
import { toggleId } from '../lib/toggleIdSet'
import { fieldInputClass } from './Field'
import { IdCheckboxList } from './IdCheckboxList'
import { SecondaryButton } from './Buttons'

type Props = {
  people: Person[]
  onAssociate: (ids: string[]) => Promise<void>
}

export function CourseStudentPicker({ people, onAssociate }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => {
      const hay = `${fullName(p)} ${p.tax_code ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [people, query])

  useEffect(() => {
    const allowed = new Set(people.map((person) => person.id))
    setSelectedIds((cur) => {
      const next = new Set([...cur].filter((id) => allowed.has(id)))
      return next.size === cur.size ? cur : next
    })
  }, [people])

  async function handleAssociate() {
    const ids = [...selectedIds]
    if (ids.length === 0 || busy) return
    setBusy(true)
    try {
      await onAssociate(ids)
      setSelectedIds(new Set())
      setQuery('')
    } catch {
      // Il messaggio resta nel pannello del corso.
    } finally {
      setBusy(false)
    }
  }

  const count = selectedIds.size

  return (
    <div className="mb-3 space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca alunno per nome o codice fiscale"
        className={fieldInputClass}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {count} selezionat{count === 1 ? 'o' : 'i'}
          {query.trim() ? ` · ${filtered.length} trovat${filtered.length === 1 ? 'o' : 'i'}` : ''}
        </p>
        <div className="flex gap-2">
          <SecondaryButton
            type="button"
            className="px-2 py-1 text-xs"
            disabled={filtered.length === 0}
            onClick={() =>
              setSelectedIds((cur) => {
                const next = new Set(cur)
                for (const person of filtered) next.add(person.id)
                return next
              })
            }
          >
            Tutti
          </SecondaryButton>
          <SecondaryButton
            type="button"
            className="px-2 py-1 text-xs"
            disabled={count === 0}
            onClick={() => setSelectedIds(new Set())}
          >
            Nessuno
          </SecondaryButton>
        </div>
      </div>
      <IdCheckboxList
        items={filtered.map((p) => ({
          id: p.id,
          label: `${fullName(p)}${p.tax_code ? ` (${p.tax_code})` : ''}`,
        }))}
        selectedIds={selectedIds}
        onToggle={(id) => setSelectedIds((cur) => toggleId(cur, id))}
        emptyText="Nessun alunno disponibile."
        maxHeightClass="max-h-72"
      />
      <SecondaryButton type="button" disabled={count === 0 || busy} onClick={() => void handleAssociate()}>
        {busy
          ? 'Associazione…'
          : count === 0
            ? 'Associa alunni'
            : count === 1
              ? 'Associa 1 alunno'
              : `Associa ${count} alunni`}
      </SecondaryButton>
    </div>
  )
}
