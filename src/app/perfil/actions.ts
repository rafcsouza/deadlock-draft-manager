"use server"

import { revalidatePath } from "next/cache"
import { formText as text, newPasswordError, readSteamAccount, usernameError } from "@/lib/account-form"
import { getCurrentUser, hashSecret, validAvatar, verifySecret } from "@/lib/auth"
import { db } from "@/lib/db"
import { KEEP_AVATAR } from "@/lib/profile-form"

export type ProfileState = { error?: string; ok?: string }

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await getCurrentUser()
  if (!user || user.isGuest) return { error: "Faça login com uma conta." }

  const username = text(form, "username")
  const nameError = usernameError(username, user.id)
  if (nameError) return { error: nameError }

  // Avatar: mantém, remove ("") ou troca (imagem nova).
  const avatarField = text(form, "avatar")
  if (avatarField && avatarField !== KEEP_AVATAR && !validAvatar(avatarField)) {
    return { error: "Não foi possível usar essa imagem. Tente outra." }
  }

  // SteamID vazio desliga o perfil das partidas.
  const steam = readSteamAccount(form, user.id)
  if ("error" in steam) return steam
  const steamAccountId = steam.accountId

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
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string }
  if (!(await verifySecret(String(form.get("current") ?? ""), row.password_hash))) return { error: "A senha atual está errada." }
  const passwordError = newPasswordError(form)
  if (passwordError) return { error: passwordError }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashSecret(String(form.get("password"))), user.id)
  return { ok: "Senha trocada." }
}
