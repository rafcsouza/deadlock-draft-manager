"use server"

import { redirect } from "next/navigation"
import {
  clearFailures,
  createSession,
  destroySession,
  hashSecret,
  isLocked,
  normalizeAnswer,
  PASSWORD_MIN,
  registerFailure,
  safeNext,
  USERNAME_PATTERN,
  validAvatar,
  verifySecret,
} from "@/lib/auth"
import { db } from "@/lib/db"
import { parseSteamId } from "@/lib/steam"

export type FormState = {
  error?: string
  // Recuperação de senha: pergunta encontrada para o usuário.
  question?: string
  username?: string
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim()

const LOCKED_MESSAGE = "Muitas tentativas erradas. Espere 5 minutos e tente de novo."

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const username = text(form, "username")
  const password = String(form.get("password") ?? "")
  const confirm = String(form.get("confirm") ?? "")
  const question = text(form, "question") === "custom" ? text(form, "customQuestion") : text(form, "question")
  const answer = normalizeAnswer(text(form, "answer"))
  const avatar = text(form, "avatar")

  if (!USERNAME_PATTERN.test(username)) {
    return { error: "O nome de usuário deve ter de 3 a 20 caracteres: letras, números, ponto, hífen ou _." }
  }
  if (password.length < PASSWORD_MIN) return { error: `A senha deve ter pelo menos ${PASSWORD_MIN} caracteres.` }
  if (password !== confirm) return { error: "As senhas não conferem." }
  if (question.length < 5 || question.length > 120) return { error: "Escolha ou escreva uma pergunta de segurança." }
  if (answer.length < 2) return { error: "Escreva a resposta da pergunta de segurança." }
  if (avatar && !validAvatar(avatar)) return { error: "Não foi possível usar essa imagem. Tente outra." }
  const steam = parseSteamId(text(form, "steamId"))
  if ("error" in steam) return { error: steam.error }

  const taken = db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)
  if (taken) return { error: "Esse nome de usuário já está em uso." }
  const steamTaken = db.prepare("SELECT 1 FROM users WHERE steam_account_id = ?").get(steam.accountId)
  if (steamTaken) return { error: "Essa conta Steam já está ligada a outro perfil." }

  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, security_question, security_answer_hash, avatar, steam_account_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(username, await hashSecret(password), question, await hashSecret(answer), avatar || null, steam.accountId, Date.now())

  await createSession(Number(result.lastInsertRowid))
  redirect(safeNext(form.get("next")))
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const username = text(form, "username")
  const password = String(form.get("password") ?? "")
  const key = `login:${username.toLowerCase()}`

  if (isLocked(key)) return { error: LOCKED_MESSAGE }

  const user = db.prepare("SELECT id, password_hash FROM users WHERE username = ?").get(username) as
    | { id: number; password_hash: string }
    | undefined
  if (!user || !(await verifySecret(password, user.password_hash))) {
    registerFailure(key)
    return { error: "Usuário ou senha incorretos." }
  }

  clearFailures(key)
  await createSession(user.id)
  redirect(safeNext(form.get("next")))
}

// Recuperação em duas etapas: 1) achar a pergunta do usuário; 2) responder e definir nova senha.
export async function recoverPassword(state: FormState, form: FormData): Promise<FormState> {
  const username = text(form, "username")
  const user = db
    .prepare("SELECT id, security_question, security_answer_hash FROM users WHERE username = ?")
    .get(username) as { id: number; security_question: string; security_answer_hash: string } | undefined

  if (!user) return { error: "Usuário não encontrado." }
  if (!form.has("answer")) return { username, question: user.security_question }

  const keep = { username, question: user.security_question }
  const key = `recover:${username.toLowerCase()}`
  if (isLocked(key)) return { ...keep, error: LOCKED_MESSAGE }

  const password = String(form.get("password") ?? "")
  const confirm = String(form.get("confirm") ?? "")
  if (password.length < PASSWORD_MIN) return { ...keep, error: `A senha deve ter pelo menos ${PASSWORD_MIN} caracteres.` }
  if (password !== confirm) return { ...keep, error: "As senhas não conferem." }

  if (!(await verifySecret(normalizeAnswer(text(form, "answer")), user.security_answer_hash))) {
    registerFailure(key)
    return { ...keep, error: "Resposta incorreta." }
  }

  clearFailures(key)
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashSecret(password), user.id)
  // Senha trocada: encerra as sessões antigas e entra com uma nova.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id)
  await createSession(user.id)
  redirect("/")
}

export async function signOut() {
  await destroySession()
  redirect("/entrar")
}
