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
    -- account_id da Steam (SteamID3, 32 bits), opcional: liga o perfil aos stats das partidas.
    steam_account_id INTEGER UNIQUE,
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

  -- Jogadores com mais de uma conta Steam: todas as contas de um grupo contam como a principal.
  CREATE TABLE IF NOT EXISTS account_links (
    account_id INTEGER PRIMARY KEY,
    main_account_id INTEGER NOT NULL
  );

  -- Nome fixo de um jogador no leaderboard (no lugar do nome atual da Steam).
  CREATE TABLE IF NOT EXISTS player_names (
    account_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
`

function open() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = new DatabaseSync(DB_PATH)
  // busy_timeout primeiro: o build do Next abre o banco em vários processos ao mesmo tempo, e sem
  // espera o segundo a escrever (ex.: o schema) falha com "database is locked".
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
  return db
}

// Reaproveita a conexão entre recarregamentos do servidor de desenvolvimento.
const globalForDb = globalThis as unknown as { db?: DatabaseSync }
export const db = globalForDb.db ?? open()
if (process.env.NODE_ENV !== "production") globalForDb.db = db
db.exec(SCHEMA)

// Migrações simples para bancos criados antes de uma coluna existir. O build abre o banco em vários
// processos ao mesmo tempo, então outro processo pode ter criado a coluna entre a checagem e o ALTER.
function addColumn(table: string, column: string, definition: string) {
  const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
  if (columns.includes(column)) return
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  } catch (e) {
    if (!String(e).includes("duplicate column")) throw e
  }
}

// Visitantes: contas temporárias, sem senha, apagadas quando a sessão expira.
addColumn("users", "is_guest", "INTEGER NOT NULL DEFAULT 0")
// Registro do draft: time que ganhou a moeda e a ordem em que os capitães escolheram os jogadores.
addColumn("drafts", "player_first", "TEXT")
addColumn("drafts", "player_picks", "TEXT NOT NULL DEFAULT '[]'")
