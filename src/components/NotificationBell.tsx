import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Notification } from '../types/db'
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications'

function fmtWhen(value: string): string {
  const d = new Date(value)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return 'Adesso'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [list, count] = await Promise.all([listNotifications(), countUnreadNotifications()])
      setItems(list)
      setUnread(count)
    } catch {
      /* silenzioso: polling non blocca l'app */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    const interval = window.setInterval(() => void refresh(), 60_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function handleOpen() {
    setOpen((v) => !v)
    if (!open) await refresh()
  }

  async function handleClick(n: Notification) {
    if (!n.read_at) {
      await markNotificationRead(n.id)
      setUnread((c) => Math.max(0, c - 1))
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
        ),
      )
    }
    setOpen(false)
  }

  async function handleMarkAll() {
    await markAllNotificationsRead()
    setUnread(0)
    setItems((prev) =>
      prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })),
    )
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => void handleOpen()}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Notifiche"
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="h-5 w-5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0"
          />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">Notifiche</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Segna tutte lette
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Caricamento…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Nessuna notifica</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((n) => (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => void handleClick(n)}
                        className={`block px-4 py-3 hover:bg-slate-50 ${
                          !n.read_at ? 'bg-indigo-50/50' : ''
                        }`}
                      >
                        <NotificationRow n={n} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleClick(n)}
                        className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${
                          !n.read_at ? 'bg-indigo-50/50' : ''
                        }`}
                      >
                        <NotificationRow n={n} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationRow({ n }: { n: Notification }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{n.title}</p>
        <span className="shrink-0 text-[10px] text-slate-400">{fmtWhen(n.created_at)}</span>
      </div>
      {n.body && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.body}</p>}
    </>
  )
}
