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

export type User = { id: number; username: string; avatar: string | null }

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

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex")
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
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
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token)
  store.delete(SESSION_COOKIE)
}

// Usuário logado nesta requisição (ou null).
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.avatar FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as User | undefined
  return row ?? null
})

// Para páginas que exigem login: manda para /entrar e volta depois.
export async function requireUser(returnTo: string) {
  const user = await getCurrentUser()
  if (!user) redirect(`/entrar?next=${encodeURIComponent(returnTo)}`)
  return user
}

// Só aceita caminhos internos, para o "next" não virar redirecionamento para outro site.
export function safeNext(next: unknown) {
  // "\" também é barrado: navegadores tratam "/\site.com" como "//site.com".
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/"
}
