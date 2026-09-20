export const LIST_PAGE_SIZE = 25

export function totalPages(count: number, pageSize = LIST_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize) || 1)
}

export function paginate<T>(items: T[], page: number, pageSize = LIST_PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}
