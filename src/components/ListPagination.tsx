import { SecondaryButton } from './Buttons'

interface Props {
  page: number
  pages: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}

export function ListPagination({ page, pages, pageSize, total, onPage }: Props) {
  if (total <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">
        {from}–{to} di {total}
      </p>
      <div className="flex items-center gap-2">
        <SecondaryButton
          type="button"
          disabled={page <= 1}
          className="!px-3 !py-1.5 !text-xs"
          onClick={() => onPage(page - 1)}
        >
          Precedente
        </SecondaryButton>
        <span className="text-xs tabular-nums text-slate-500">
          {page} / {pages}
        </span>
        <SecondaryButton
          type="button"
          disabled={page >= pages}
          className="!px-3 !py-1.5 !text-xs"
          onClick={() => onPage(page + 1)}
        >
          Successiva
        </SecondaryButton>
      </div>
    </div>
  )
}
