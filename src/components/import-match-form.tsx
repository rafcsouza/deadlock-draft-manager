"use client"

import { startTransition, useActionState, useState } from "react"
import { importMatchAction, verifyMatchAction, type ImportState } from "@/app/historico/actions"
import { PrintImport, type HeroOption } from "@/components/print-review"

type Action = (state: ImportState, form: FormData) => Promise<ImportState>

// Envia pelo onSubmit para o React não limpar os campos quando o servidor devolve erro.
function useFormAction(action: Action) {
  const [state, dispatch, pending] = useActionState(action, {})
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => dispatch(data))
  }
  return { state, pending, onSubmit }
}

const gradient = { background: "linear-gradient(135deg, var(--team-a) 0%, var(--team-b) 100%)" }
const inputClass =
  "min-w-0 flex-1 rounded-lg border border-border bg-muted/60 px-3 py-2.5 font-mono text-sm outline-none focus:border-muted-foreground/60"

function Feedback({ state, pending }: { state: ImportState; pending: boolean }) {
  if (pending) return null
  if (state.error) return <p role="alert" className="mt-2 text-xs text-red-300">{state.error}</p>
  if (state.ok) return <p className="mt-2 text-xs text-green-300">{state.ok}</p>
  return null
}

// Adiciona ao histórico uma partida que já aconteceu: pelo ID (API) ou por um print do placar.
export function ImportMatchForm({ heroes }: { heroes: HeroOption[] }) {
  const [tab, setTab] = useState<"id" | "print">("id")

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card/80 p-4">
      <div className="mb-3 flex items-center gap-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Adicionar partida</p>
        <div className="ml-auto grid grid-cols-2 rounded-lg bg-muted/60 p-0.5 text-xs font-semibold" role="tablist">
          {(["id", "print"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "id" ? "Pelo ID" : "Por print"}
            </button>
          ))}
        </div>
      </div>
      {tab === "id" ? <ByIdForm /> : <PrintImport heroes={heroes} />}
    </div>
  )
}

function ByIdForm() {
  const { state, pending, onSubmit } = useFormAction(importMatchAction)
  const [matchId, setMatchId] = useState("")
  return (
    <form onSubmit={onSubmit}>
      <div className="flex gap-2">
        <input
          name="matchId"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="ID da partida (ex.: 109513494)"
          aria-label="ID da partida"
          disabled={pending}
          className={inputClass}
        />
        <button type="submit" disabled={pending || !matchId} className="shrink-0 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-60" style={gradient}>
          {pending ? "Buscando..." : "Adicionar"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Stats completos (itens, MVP, SteamIDs) vindos da API do Deadlock. Entra no leaderboard.
      </p>
      <Feedback state={state} pending={pending} />
    </form>
  )
}

// Na partida pendente: vincula pelo ID da partida e confirma os dados pela API.
export function VerifyMatchForm({ draftId, matchId: initial }: { draftId: string; matchId: number | null }) {
  const { state, pending, onSubmit } = useFormAction(verifyMatchAction)
  const [matchId, setMatchId] = useState(initial ? String(initial) : "")
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-yellow-600/40 bg-yellow-600/10 p-3">
      <input type="hidden" name="draftId" value={draftId} />
      <p className="text-xs text-yellow-200">
        Pendente: dados lidos do print, sem SteamIDs. Vincule pela API para confirmar e entrar no leaderboard.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          name="matchId"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="ID da partida"
          aria-label="ID da partida para vincular"
          disabled={pending}
          className={inputClass}
        />
        <button type="submit" disabled={pending || !matchId} className="shrink-0 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-60" style={gradient}>
          {pending ? "Vinculando..." : "Vincular pela API"}
        </button>
      </div>
      <Feedback state={state} pending={pending} />
    </form>
  )
}
