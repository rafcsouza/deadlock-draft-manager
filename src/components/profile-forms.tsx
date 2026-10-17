"use client"

import { changePassword, updateProfile } from "@/app/perfil/actions"
import { AvatarPicker } from "@/components/avatar-picker"
import { Field, FormStatus, inputClass, SubmitButton, useFormAction } from "@/components/form-ui"
import { KEEP_AVATAR } from "@/lib/profile-form"

export function EditProfileForm({
  username,
  avatar,
  steam64,
}: {
  username: string
  avatar: string | null
  steam64: string | null
}) {
  const { state, onSubmit, pending } = useFormAction(updateProfile)
  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      <AvatarPicker initial={avatar} keepValue={KEEP_AVATAR} />
      <Field label="Usuário">
        <input
          name="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_.\-]{3,20}"
          title="3 a 20 caracteres: letras, números, ponto, hífen ou _"
          defaultValue={username}
          autoComplete="username"
          className={inputClass}
        />
      </Field>
      <Field label="SteamID64 (opcional)">
        <input name="steamId" defaultValue={steam64 ?? ""} inputMode="numeric" autoComplete="off" placeholder="7656119xxxxxxxxxx" className={inputClass} />
      </Field>
      <p className="-mt-2 text-left text-[11px] leading-snug text-muted-foreground">
        Liga você aos stats das partidas. Ache o seu em{" "}
        <a href="https://steamid.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          steamid.io
        </a>
        . Deixe vazio para desligar.
      </p>
      <FormStatus state={state} pending={pending} />
      <SubmitButton pending={pending} pendingText="Salvando...">Salvar perfil</SubmitButton>
    </form>
  )
}

export function ChangePasswordForm() {
  const { state, onSubmit, pending } = useFormAction(changePassword)
  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      <Field label="Senha atual">
        <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nova senha">
          <input name="password" type="password" required minLength={6} autoComplete="new-password" className={inputClass} />
        </Field>
        <Field label="Repita a senha">
          <input name="confirm" type="password" required minLength={6} autoComplete="new-password" className={inputClass} />
        </Field>
      </div>
      <FormStatus state={state} pending={pending} />
      <SubmitButton pending={pending} pendingText="Salvando...">Trocar senha</SubmitButton>
    </form>
  )
}
