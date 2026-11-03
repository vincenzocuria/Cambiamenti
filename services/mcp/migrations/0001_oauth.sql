-- OAuth 2.1 del connettore MCP (Claude e altri client remoti).
-- Login con l'utente del gestionale (Supabase Auth): la sessione Supabase dell'utente è salvata
-- solo cifrata (AES-GCM, chiave CAMBIAMENTI_MCP_TOKEN_KEY). I token OAuth sono salvati come hash.

CREATE TABLE IF NOT EXISTS oauth_clients (
    id TEXT PRIMARY KEY,
    secret_hash TEXT,
    name TEXT NOT NULL,
    redirect_uris TEXT NOT NULL,
    token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL,
    last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS oauth_codes (
    code_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    scope TEXT NOT NULL,
    sb_session_enc TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    grant_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_grants (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    access_hash TEXT NOT NULL UNIQUE,
    access_expires_at TEXT NOT NULL,
    refresh_hash TEXT NOT NULL UNIQUE,
    previous_refresh_hash TEXT,
    sb_session_enc TEXT NOT NULL,
    scope TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_attempts (
    key TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_grants_prev ON oauth_grants(previous_refresh_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_grants_user ON oauth_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_key ON auth_attempts(key, created_at);
