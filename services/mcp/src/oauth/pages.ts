// Pagine HTML server-side per l'autorizzazione OAuth (login con l'utente del gestionale + consenso).

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const STYLE = `
:root{color-scheme:light dark;--bg:#f6f5f2;--card:#fff;--fg:#1d1d1b;--muted:#6b6a66;--line:#e3e1db;--accent:#1f4e79;--accent-fg:#fff;--danger:#a33}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--fg:#ecebe6;--muted:#a3a29c;--line:#33332f;--accent:#8db8e0;--accent-fg:#0f1620;--danger:#e88}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px}
main{width:100%;max-width:420px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px}
h1{font-size:1.25rem;margin:0 0 4px}p{margin:8px 0;color:var(--muted)}strong{color:var(--fg)}
label{display:block;font-size:.875rem;margin:14px 0 4px}input[type=email],input[type=password]{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--fg);font:inherit}
.row{display:flex;gap:10px;margin-top:22px}button{flex:1;padding:11px 14px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--fg);font:inherit;cursor:pointer}
button.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent);font-weight:600}
.box{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:16px 0;font-size:.9rem}.box p{margin:2px 0}
.error{color:var(--danger);font-size:.9rem;margin-top:12px}.brand{font-weight:700;letter-spacing:.02em;margin-bottom:18px}
`

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body><main><div class="brand">Cambia-Menti · Gestionale</div>${body}</main></body></html>`
}

export function errorPage(message: string): string {
  return layout('Autorizzazione non riuscita', `<h1>Autorizzazione non riuscita</h1><p>${escapeHtml(message)}</p>`)
}

export function consentPage(input: {
  clientName: string
  redirectHost: string
  params: Record<string, string>
  csrf: string
  error?: string
}): string {
  const hidden = Object.entries(input.params)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('')
  const error = input.error ? `<p class="error" role="alert">${escapeHtml(input.error)}</p>` : ''
  return layout(
    'Collega il gestionale',
    `<h1>Collegare ${escapeHtml(input.clientName)} al gestionale?</h1>
     <p>Accedi con il tuo utente del gestionale. Potrà leggere corsi, persone, pagamenti e documenti e aggiornarli con i tuoi stessi permessi. Non può cancellare nulla e ogni modifica viene registrata.</p>
     <div class="box"><p>Dopo l'accesso tornerai su <strong>${escapeHtml(input.redirectHost)}</strong>.</p><p>Per scollegarlo basta rimuovere il connettore da Claude.</p></div>
     <form method="post" action="/oauth/authorize">${hidden}<input type="hidden" name="csrf" value="${escapeHtml(input.csrf)}">
     <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required>
     <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>
     ${error}
     <div class="row"><button type="submit" name="decision" value="deny" formnovalidate>Annulla</button><button class="primary" type="submit" name="decision" value="allow">Accedi e collega</button></div>
     </form>`,
  )
}
