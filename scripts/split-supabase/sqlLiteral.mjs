export function sqlLiteral(value, dataType = '') {
  if (value === null || value === undefined) return 'NULL'
  const t = String(dataType).toLowerCase()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (t.includes('json')) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    return `'${raw.replace(/'/g, "''")}'::jsonb`
  }
  if (t.includes('timestamp') || t.includes('date')) {
    return `'${String(value).replace(/'/g, "''")}'::${t.includes('date') && !t.includes('time') ? 'date' : 'timestamptz'}`
  }
  if (t === 'uuid' || t.includes('char') || t === 'text' || t === 'inet') {
    return `'${String(value).replace(/'/g, "''")}'`
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  }
  return `'${String(value).replace(/'/g, "''")}'`
}
