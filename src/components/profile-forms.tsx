"use client"

import { startTransition, useActionState } from "react"
import { changePassword, updateProfile, type ProfileState } from "@/app/perfil/actions"
import { AvatarPicker } from "@/components/avatar-picker"
import { KEEP_AVATAR } from "@/lib/profile-form"

const inputClass =
  "w-full rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-muted-foreground/60"
const gradient = { background: "linear-gradient(135deg, var(--team-a) 0%, var(--team-b) 100%)" }

// Envia pelo onSubmit para o React não limpar os campos quando o servidor devolve erro.
function useFormAction(fn: (state: ProfileState, form: FormData) => Promise<ProfileState>) {
  const [state, dispatch, pending] = useActionState(fn, {})
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => dispatch(data))
  }
  return { state, onSubmit, pending }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-left">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Feedback({ state, pending }: { state: ProfileState; pending: boolean }) {
  if (pending) return null
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-red-600/40 bg-red-600/10 px-3 py-2 text-left text-xs text-red-300">
        {state.error}
      </p>
    )
  }
  if (state.ok) return <p className="text-left text-xs text-green-300">{state.ok}</p>
  return null
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl text-sm font-bold text-white shadow-lg shadow-black/40 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      style={gradient}
    >
      {pending ? "Salvando..." : children}
    </button>
  )
}

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
      <Feedback state={state} pending={pending} />
      <Submit pending={pending}>Salvar perfil</Submit>
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
      <Feedback state={state} pending={pending} />
      <Submit pending={pending}>Trocar senha</Submit>
    </form>
  )
}
