"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ORDER_LABELS, type DraftOrder } from "@/lib/draft-rules"
import type { OpenRoom } from "@/lib/room-store"

// "Criar Draft": escolhe a ordem de bans e picks e se a sala é aberta (aparece aqui na página inicial) ou só por convite.
export function CreateDraftButton() {
  const [open, setOpen] = useState(false)
  const [order, setOrder] = useState<DraftOrder>("competitivo")
  const suffix = order === "alternado" ? "&ordem=alternado" : ""
  const primary = "bg-team-gradient flex h-12 w-full items-center justify-between rounded-xl px-5 text-sm font-bold text-white shadow-lg shadow-black/40 transition-all hover:-translate-y-0.5"

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primary}>
        Criar Draft
        <span aria-hidden="true">+</span>
      </button>
    )
  }
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-2">
      <p className="px-1 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ordem do draft</p>
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1" role="radiogroup" aria-label="Ordem do draft">
        {(Object.keys(ORDER_LABELS) as DraftOrder[]).map((o) => (
          <button
            key={o}
            role="radio"
            aria-checked={order === o}
            onClick={() => setOrder(o)}
            className={`rounded-lg px-2 py-1.5 text-left transition-colors ${order === o ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span className="block text-xs font-bold">{ORDER_LABELS[o].name}</span>
            <span className="block text-[10px] leading-tight opacity-80">{ORDER_LABELS[o].hint}</span>
          </button>
        ))}
      </div>
      <p className="px-1 pt-1 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Quem pode entrar?</p>
      <Link href={`/draft/novo?tipo=aberta${suffix}`} className={`${primary} h-auto py-2.5`}>
        <span className="text-left">
          Sala aberta
          <span className="block text-[11px] font-normal opacity-80">Aparece aqui na página inicial para todos</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>
      <Link
        href={`/draft/novo?tipo=convite${suffix}`}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-muted-foreground/50"
      >
        <span className="text-left">
          Só por convite
          <span className="block text-[11px] font-normal text-muted-foreground">Só entra quem tiver o link da sala</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>
      <button onClick={() => setOpen(false)} className="w-full py-1 text-xs text-muted-foreground hover:text-foreground">
        Cancelar
      </button>
    </div>
  )
}

// Salas abertas agora; a lista se atualiza sozinha a cada poucos segundos.
export function OpenRooms({ rooms }: { rooms: OpenRoom[] }) {
  const router = useRouter()
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 8000)
    return () => window.clearInterval(id)
  }, [router])

  return (
    <div className="w-full space-y-2 text-left">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${rooms.length ? "animate-pulse bg-green-400" : "bg-muted-foreground/40"}`} />
        Salas abertas
      </p>
      {rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          Nenhuma sala aberta agora. Crie uma!
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rooms.map((room) => (
            <li key={room.code}>
              <Link
                href={`/draft/${room.code}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2 transition-colors hover:border-muted-foreground/50 hover:bg-muted/70"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">Sala de {room.host}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {room.players} {room.players === 1 ? "jogador" : "jogadores"} · {room.phase} · ordem {ORDER_LABELS[room.order].name.toLowerCase()}
                  </span>
                </span>
                <span className="bg-team-gradient shrink-0 rounded-md px-2.5 py-1 text-xs font-bold text-white">Entrar</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
