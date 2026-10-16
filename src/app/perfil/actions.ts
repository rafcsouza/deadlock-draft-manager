"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUser, hashSecret, PASSWORD_MIN, USERNAME_PATTERN, validAvatar, verifySecret } from "@/lib/auth"
import { db } from "@/lib/db"
import { KEEP_AVATAR } from "@/lib/profile-form"
import { parseSteamId } from "@/lib/steam"

export type ProfileState = { error?: string; ok?: string }


const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim()

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await getCurrentUser()
  if (!user || user.isGuest) return { error: "Faça login com uma conta." }

  const username = text(form, "username")
  if (!USERNAME_PATTERN.test(username)) {
    return { error: "O nome de usuário deve ter de 3 a 20 caracteres: letras, números, ponto, hífen ou _." }
  }
  if (db.prepare("SELECT 1 FROM users WHERE username = ? AND id != ?").get(username, user.id)) {
    return { error: "Esse nome de usuário já está em uso." }
  }

  // Avatar: mantém, remove ("") ou troca (imagem nova).
  const avatarField = text(form, "avatar")
  if (avatarField && avatarField !== KEEP_AVATAR && !validAvatar(avatarField)) {
    return { error: "Não foi possível usar essa imagem. Tente outra." }
  }

  // SteamID é opcional: vazio desliga o perfil das partidas.
  const steamText = text(form, "steamId")
  const steam = steamText ? parseSteamId(steamText) : null
  if (steam && "error" in steam) return { error: steam.error }
  const steamAccountId = steam ? steam.accountId : null
  if (steamAccountId !== null && db.prepare("SELECT 1 FROM users WHERE steam_account_id = ? AND id != ?").get(steamAccountId, user.id)) {
    return { error: "Essa conta Steam já está ligada a outro perfil." }
  }

  if (avatarField === KEEP_AVATAR) {
    db.prepare("UPDATE users SET username = ?, steam_account_id = ? WHERE id = ?").run(username, steamAccountId, user.id)
  } else {
    db.prepare("UPDATE users SET username = ?, steam_account_id = ?, avatar = ? WHERE id = ?").run(
      username,
      steamAccountId,
      avatarField || null,
      user.id,
    )
  }
  revalidatePath("/", "layout")
  return { ok: "Perfil salvo." }
}

export async function changePassword(_: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await getCurrentUser()
  if (!user || user.isGuest) return { error: "Faça login com uma conta." }
  const current = String(form.get("current") ?? "")
  const password = String(form.get("password") ?? "")
  const confirm = String(form.get("confirm") ?? "")

  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string }
  if (!(await verifySecret(current, row.password_hash))) return { error: "A senha atual está errada." }
  if (password.length < PASSWORD_MIN) return { error: `A nova senha deve ter pelo menos ${PASSWORD_MIN} caracteres.` }
  if (password !== confirm) return { error: "As senhas novas não conferem." }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashSecret(password), user.id)
  return { ok: "Senha trocada." }
}
