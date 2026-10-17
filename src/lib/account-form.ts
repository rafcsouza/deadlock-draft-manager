import "server-only"
import { PASSWORD_MIN, USERNAME_PATTERN } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseSteamId } from "@/lib/steam"

// Leitura e validação dos campos de conta, compartilhadas entre cadastro, recuperação de senha e edição de perfil.

export const formText = (form: FormData, name: string) => String(form.get(name) ?? "").trim()

// exceptUserId: na edição de perfil, o próprio nome atual não conta como "em uso".
export function usernameError(username: string, exceptUserId?: number) {
  if (!USERNAME_PATTERN.test(username)) {
    return "O nome de usuário deve ter de 3 a 20 caracteres: letras, números, ponto, hífen ou _."
  }
  if (db.prepare("SELECT 1 FROM users WHERE username = ? AND id IS NOT ?").get(username, exceptUserId ?? null)) {
    return "Esse nome de usuário já está em uso."
  }
  return null
}

export function newPasswordError(form: FormData) {
  const password = String(form.get("password") ?? "")
  if (password.length < PASSWORD_MIN) return `A senha deve ter pelo menos ${PASSWORD_MIN} caracteres.`
  if (password !== String(form.get("confirm") ?? "")) return "As senhas não conferem."
  return null
}

// SteamID é opcional (liga o perfil aos stats das partidas): campo vazio vira null.
export function readSteamAccount(form: FormData, exceptUserId?: number): { accountId: number | null } | { error: string } {
  const raw = formText(form, "steamId")
  if (!raw) return { accountId: null }
  const steam = parseSteamId(raw)
  if ("error" in steam) return steam
  if (db.prepare("SELECT 1 FROM users WHERE steam_account_id = ? AND id IS NOT ?").get(steam.accountId, exceptUserId ?? null)) {
    return { error: "Essa conta Steam já está ligada a outro perfil." }
  }
  return steam
}
