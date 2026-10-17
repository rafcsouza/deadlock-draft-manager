"use client"

import { startTransition, useActionState } from "react"

// Peças comuns dos formulários (conta, perfil e importação de partidas).

type Status = { error?: string; ok?: string }

export const inputClass =
  "w-full rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-muted-foreground/60"

// Envia pelo onSubmit em vez de <form action>: assim o React não limpa os campos
// quando o servidor devolve um erro (ex.: senha errada).
export function useFormAction<S extends Status>(fn: (state: Awaited<S>, form: FormData) => Promise<S>) {
  const [state, dispatch, pending] = useActionState<S, FormData>(fn, {} as Awaited<S>)
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => dispatch(data))
  }
  return { state, onSubmit, pending }
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-left">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function SubmitButton({ pending, pendingText = "Aguarde...", children }: { pending: boolean; pendingText?: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-team-gradient h-11 w-full rounded-xl text-sm font-bold text-white shadow-lg shadow-black/40 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
    >
      {pending ? pendingText : children}
    </button>
  )
}

// Erro ou confirmação devolvidos pelo servidor. "box" destaca o erro numa caixa; "inline" é só o texto.
export function FormStatus({ state, pending, variant = "box" }: { state: Status; pending: boolean; variant?: "box" | "inline" }) {
  if (pending) return null
  if (state.error) {
    return (
      <p
        role="alert"
        className={
          variant === "box"
            ? "rounded-lg border border-red-600/40 bg-red-600/10 px-3 py-2 text-left text-xs text-red-300"
            : "mt-2 text-xs text-red-300"
        }
      >
        {state.error}
      </p>
    )
  }
  if (state.ok) return <p className={`text-xs text-green-300 ${variant === "box" ? "text-left" : "mt-2"}`}>{state.ok}</p>
  return null
}
