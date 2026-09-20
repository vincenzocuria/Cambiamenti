import { fieldInputClass } from './Field'
import { SecondaryButton } from './Buttons'

interface Props {
  search: string
  onSearch: (value: string) => void
  placeholder: string
  resultCount: number
  totalCount: number
  unitSingular: string
  unitPlural: string
  onExportExcel: () => void
  onExportPdf: () => void
}

export function ListToolbar({
  search,
  onSearch,
  placeholder,
  resultCount,
  totalCount,
  unitSingular,
  unitPlural,
  onExportExcel,
  onExportPdf,
}: Props) {
  const unit = totalCount === 1 ? unitSingular : unitPlural
  const countLabel =
    resultCount === totalCount ? `${totalCount} ${unit}` : `${resultCount} di ${totalCount}`

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <input
        type="search"
        placeholder={placeholder}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className={`${fieldInputClass} max-w-md`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-slate-500">{countLabel}</p>
        <SecondaryButton type="button" onClick={onExportExcel} className="!px-3 !py-1.5 !text-xs">
          Excel
        </SecondaryButton>
        <SecondaryButton type="button" onClick={onExportPdf} className="!px-3 !py-1.5 !text-xs">
          PDF
        </SecondaryButton>
      </div>
    </div>
  )
}
