// D1 finto su node:sqlite per i test (stessa interfaccia usata dal Worker).
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

class Stmt {
  constructor(private db: DatabaseSync, private sql: string, private params: unknown[] = []) {}
  bind(...params: unknown[]) {
    return new Stmt(this.db, this.sql, params)
  }
  async first<T>() {
    return (this.db.prepare(this.sql).get(...(this.params as never[])) as T) ?? null
  }
  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...(this.params as never[])) as T[] }
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...(this.params as never[]))
    return { meta: { changes: Number(r.changes) } }
  }
}

export function fakeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(fileURLToPath(new URL('../migrations/0001_oauth.sql', import.meta.url).href), 'utf8'))
  return { prepare: (sql: string) => new Stmt(db, sql) } as unknown as D1Database
}
