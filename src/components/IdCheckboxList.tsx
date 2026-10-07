type Item = { id: string; label: string; hint?: string }

type Props = {
  items: Item[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  emptyText: string
  maxHeightClass?: string
}

export function IdCheckboxList({
  items,
  selectedIds,
  onToggle,
  emptyText,
  maxHeightClass = 'max-h-48',
}: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyText}</p>
  }

  return (
    <ul
      className={`${maxHeightClass} divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200`}
    >
      {items.map((item) => (
        <li key={item.id}>
          <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm leading-5 text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selectedIds.has(item.id)}
              onChange={() => onToggle(item.id)}
            />
            <span className="min-w-0">
              {item.label}
              {item.hint ? <span className="text-slate-500"> · {item.hint}</span> : null}
            </span>
          </label>
        </li>
      ))}
    </ul>
  )
}
