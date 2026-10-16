import "server-only"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

// Banco SQLite embutido no Node; os dados ficam em data/app.db (fora do git).
const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db")

// Idempotente (IF NOT EXISTS): roda a cada carregamento do módulo, inclusive quando
// a conexão é reaproveitada no modo de desenvolvimento.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer_hash TEXT NOT NULL,
    avatar TEXT,
    -- account_id da Steam (SteamID3, 32 bits): é como a API do Deadlock identifica o jogador.
    steam_account_id INTEGER NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- Histórico de partidas: de um draft da plataforma (source = draft), importadas pelo ID
  -- (source = import) ou lidas de um print (source = print). Times, escolhas e stats em JSON.
  -- verified = 0: dados de print ainda não confirmados pela API (fora do leaderboard).
  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    room_code TEXT,
    finished_at INTEGER NOT NULL,
    played_at INTEGER NOT NULL,
    first_team TEXT,
    turn_seconds INTEGER,
    team_a TEXT NOT NULL,
    team_b TEXT NOT NULL,
    steps TEXT NOT NULL,
    match_id INTEGER UNIQUE,
    verified INTEGER NOT NULL DEFAULT 1,
    winner TEXT NOT NULL,
    duration_s INTEGER NOT NULL,
    stats TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS drafts_played_at ON drafts (played_at DESC);
`

function open() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = new DatabaseSync(DB_PATH)
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
  return db
}

// Reaproveita a conexão entre recarregamentos do servidor de desenvolvimento.
const globalForDb = globalThis as unknown as { db?: DatabaseSync }
export const db = globalForDb.db ?? open()
if (process.env.NODE_ENV !== "production") globalForDb.db = db
db.exec(SCHEMA)
