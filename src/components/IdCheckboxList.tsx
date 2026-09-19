type Item = { id: string; label: string }

type Props = {
  items: Item[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  emptyText: string
}

export function IdCheckboxList({ items, selectedIds, onToggle, emptyText }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyText}</p>
  }

  return (
    <ul className="max-h-48 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
      {items.map((item) => (
        <li key={item.id}>
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={selectedIds.has(item.id)}
              onChange={() => onToggle(item.id)}
            />
            <span>{item.label}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}
