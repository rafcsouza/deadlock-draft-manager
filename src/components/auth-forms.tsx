"use client"

import Link from "next/link"
import { startTransition, useActionState, useState } from "react"
import { recoverPassword, signIn, signInAsGuest, signUp, type FormState } from "@/app/auth-actions"
import { AvatarPicker } from "@/components/avatar-picker"
import { SECURITY_QUESTIONS } from "@/lib/security-questions"

const inputClass =
  "w-full rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-muted-foreground/60"

// Envia pelo onSubmit em vez de <form action>: assim o React não limpa os campos
// quando o servidor devolve um erro (ex.: senha errada).
function useFormAction(fn: (state: FormState, form: FormData) => Promise<FormState>) {
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

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl text-sm font-bold text-white shadow-lg shadow-black/40 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, var(--team-a) 0%, var(--team-b) 100%)" }}
    >
      {pending ? "Aguarde..." : children}
    </button>
  )
}

function ErrorMessage({ state }: { state: FormState }) {
  if (!state.error) return null
  return (
    <p role="alert" className="rounded-lg border border-red-600/40 bg-red-600/10 px-3 py-2 text-left text-xs text-red-300">
      {state.error}
    </p>
  )
}

export function SignInForm({ next }: { next: string }) {
  const { state, onSubmit, pending } = useFormAction(signIn)
  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Usuário">
        <input name="username" required autoComplete="username" autoFocus className={inputClass} />
      </Field>
      <Field label="Senha">
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <ErrorMessage state={state} />
      <Submit pending={pending}>Entrar</Submit>
      <div className="flex justify-between text-xs text-muted-foreground">
        <Link href="/recuperar" className="hover:text-foreground">
          Esqueci a senha
        </Link>
        <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="font-semibold hover:text-foreground">
          Criar perfil
        </Link>
      </div>
    </form>
  )
}

export function SignUpForm({ next }: { next: string }) {
  const { state, onSubmit, pending } = useFormAction(signUp)
  const [question, setQuestion] = useState(SECURITY_QUESTIONS[0])

  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      <input type="hidden" name="next" value={next} />
      <AvatarPicker />
      <Field label="Usuário">
        <input
          name="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_.\-]{3,20}"
          title="3 a 20 caracteres: letras, números, ponto, hífen ou _"
          autoComplete="username"
          className={inputClass}
        />
      </Field>
      <Field label="SteamID64 (opcional)">
        <input
          name="steamId"
          inputMode="numeric"
          autoComplete="off"
          placeholder="7656119xxxxxxxxxx"
          className={inputClass}
        />
      </Field>
      <p className="-mt-2 text-left text-[11px] leading-snug text-muted-foreground">
        Se preencher, seu perfil aparece com seu nome no leaderboard e nas partidas. Ache o seu em{" "}
        <a href="https://steamid.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          steamid.io
        </a>{" "}
        (também aceita o link /profiles/... ou o código de amigo).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Senha">
          <input name="password" type="password" required minLength={6} autoComplete="new-password" className={inputClass} />
        </Field>
        <Field label="Repita a senha">
          <input name="confirm" type="password" required minLength={6} autoComplete="new-password" className={inputClass} />
        </Field>
      </div>
      <Field label="Pergunta de segurança">
        <select name="question" value={question} onChange={(e) => setQuestion(e.target.value)} className={inputClass}>
          {SECURITY_QUESTIONS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
          <option value="custom">Escrever minha própria pergunta</option>
        </select>
      </Field>
      {question === "custom" && (
        <input name="customQuestion" required minLength={5} maxLength={120} placeholder="Sua pergunta" className={inputClass} />
      )}
      <Field label="Resposta">
        <input name="answer" required autoComplete="off" className={inputClass} />
      </Field>
      <p className="text-left text-[11px] leading-snug text-muted-foreground">
        A resposta serve para recuperar a senha. Maiúsculas e acentos não fazem diferença.
      </p>
      <ErrorMessage state={state} />
      <Submit pending={pending}>Criar perfil</Submit>
      <p className="text-xs text-muted-foreground">
        Já tem perfil?{" "}
        <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="font-semibold hover:text-foreground">
          Entrar
        </Link>
      </p>
    </form>
  )
}

export function RecoverForm() {
  const { state, onSubmit, pending } = useFormAction(recoverPassword)
  const found = Boolean(state.question)

  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      <Field label="Usuário">
        <input
          name="username"
          required
          autoComplete="username"
          defaultValue={state.username}
          readOnly={found}
          className={`${inputClass} ${found ? "opacity-70" : ""}`}
        />
      </Field>
      {found && (
        <>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-left text-sm">{state.question}</p>
          <Field label="Resposta">
            <input name="answer" required autoComplete="off" autoFocus className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nova senha">
              <input name="password" type="password" required minLength={6} autoComplete="new-password" className={inputClass} />
            </Field>
            <Field label="Repita a senha">
              <input name="confirm" type="password" required minLength={6} autoComplete="new-password" className={inputClass} />
            </Field>
          </div>
        </>
      )}
      <ErrorMessage state={state} />
      <Submit pending={pending}>{found ? "Trocar senha" : "Continuar"}</Submit>
      <Link href="/entrar" className="inline-block text-xs text-muted-foreground hover:text-foreground">
        ← Voltar para o login
      </Link>
    </form>
  )
}

// Entrar sem conta: só um apelido opcional.
export function GuestForm({ next }: { next: string }) {
  const { state, onSubmit, pending } = useFormAction(signInAsGuest)
  return (
    <form onSubmit={onSubmit} className="w-full space-y-3 border-t border-border pt-5">
      <input type="hidden" name="next" value={next} />
      <p className="text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Sem conta?</p>
      <div className="flex gap-2">
        <input
          name="nickname"
          maxLength={14}
          placeholder="Apelido (opcional)"
          aria-label="Apelido"
          autoComplete="off"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg border border-border bg-muted/60 px-4 text-sm font-semibold transition-colors hover:border-muted-foreground disabled:opacity-60"
        >
          {pending ? "Entrando..." : "Entrar como visitante"}
        </button>
      </div>
      <p className="text-left text-[11px] leading-snug text-muted-foreground">
        Dá para criar e entrar em salas de draft e ver o histórico e o leaderboard. O acesso de visitante dura 7 dias.
      </p>
      <ErrorMessage state={state} />
    </form>
  )
}
