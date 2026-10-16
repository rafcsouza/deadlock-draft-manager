import "server-only"
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { db } from "@/lib/db"

const scryptAsync = promisify(scrypt) as (secret: string, salt: string, keylen: number) => Promise<Buffer>

const SESSION_COOKIE = "session"
const SESSION_DAYS = 30
const GUEST_SESSION_DAYS = 7

export type User = { id: number; username: string; avatar: string | null; isGuest: boolean }

// ---------- Hash de senha e resposta de segurança ----------

export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = await scryptAsync(secret, salt, 64)
  return `${salt}:${hash.toString("hex")}`
}

export async function verifySecret(secret: string, stored: string) {
  const [salt, hex] = stored.split(":")
  if (!salt || !hex) return false
  const expected = Buffer.from(hex, "hex")
  const actual = await scryptAsync(secret, salt, expected.length)
  return timingSafeEqual(actual, expected)
}

// "  São Paulo " e "sao paulo" contam como a mesma resposta.
export function normalizeAnswer(answer: string) {
  return answer
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

// ---------- Validação ----------

export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,20}$/
export const PASSWORD_MIN = 6
const AVATAR_MAX_LENGTH = 150_000
const AVATAR_PATTERN = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/

export function validAvatar(avatar: string) {
  return avatar.length <= AVATAR_MAX_LENGTH && AVATAR_PATTERN.test(avatar)
}

// ---------- Limite de tentativas (login e recuperação) ----------

const MAX_ATTEMPTS = 5
const LOCK_MS = 5 * 60 * 1000
const globalForAttempts = globalThis as unknown as { attempts?: Map<string, { count: number; until: number }> }
const attempts = (globalForAttempts.attempts ??= new Map())

export function isLocked(key: string) {
  const entry = attempts.get(key)
  return entry !== undefined && entry.count >= MAX_ATTEMPTS && entry.until > Date.now()
}

export function registerFailure(key: string) {
  const entry = attempts.get(key)
  const expired = !entry || entry.until <= Date.now()
  const count = expired ? 1 : entry.count + 1
  attempts.set(key, { count, until: Date.now() + LOCK_MS })
}

export function clearFailures(key: string) {
  attempts.delete(key)
}

// ---------- Sessão ----------

export async function createSession(userId: number, days = SESSION_DAYS) {
  // Visitante que entrou numa conta de verdade: a conta temporária dele não serve mais.
  const previous = (await cookies()).get(SESSION_COOKIE)?.value
  if (previous) {
    db.prepare(
      "DELETE FROM users WHERE is_guest = 1 AND id != ? AND id IN (SELECT user_id FROM sessions WHERE token = ?)",
    ).run(userId, previous)
  }
  const token = randomBytes(32).toString("hex")
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  })
}

export async function destroySession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    // Visitante saindo: a conta temporária vai junto (as sessões dela caem em cascata).
    db.prepare("DELETE FROM users WHERE is_guest = 1 AND id IN (SELECT user_id FROM sessions WHERE token = ?)").run(token)
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token)
  }
  store.delete(SESSION_COOKIE)
}

// Usuário logado nesta requisição (ou null).
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.avatar, u.is_guest FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as (Omit<User, "isGuest"> & { is_guest: number }) | undefined
  if (!row) return null
  const { is_guest, ...user } = row
  return { ...user, isGuest: is_guest === 1 }
})

// Para páginas que exigem login: manda para /entrar e volta depois.
export async function requireUser(returnTo: string) {
  const user = await getCurrentUser()
  if (!user) redirect(`/entrar?next=${encodeURIComponent(returnTo)}`)
  return user
}

// ---------- Visitantes ----------

// Apaga visitantes sem nenhuma sessão válida (a sessão de visitante dura 7 dias).
function removeExpiredGuests() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now())
  db.prepare("DELETE FROM users WHERE is_guest = 1 AND id NOT IN (SELECT user_id FROM sessions)").run()
}

// Cria uma conta temporária de visitante e entra com ela. O apelido ganha um número se já estiver em uso.
export async function createGuest(nickname: string) {
  removeExpiredGuests()
  const base = (nickname.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 14) || "Visitante").padEnd(3, "_")
  let username = base
  for (let i = 0; db.prepare("SELECT 1 FROM users WHERE username = ?").get(username); i++) {
    username = `${base}-${Math.floor(1000 + Math.random() * 9000)}`
    if (i > 20) throw new Error("Não foi possível criar o visitante. Tente outro apelido.")
  }
  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, security_question, security_answer_hash, avatar, steam_account_id, created_at, is_guest)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
    )
    // Sem senha utilizável: o hash é de um valor aleatório que ninguém conhece.
    .run(username, await hashSecret(randomBytes(32).toString("hex")), "-", "-", Date.now())
  await createSession(Number(result.lastInsertRowid), GUEST_SESSION_DAYS)
}

// Só aceita caminhos internos, para o "next" não virar redirecionamento para outro site.
export function safeNext(next: unknown) {
  // "\" também é barrado: navegadores tratam "/\site.com" como "//site.com".
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/"
}
