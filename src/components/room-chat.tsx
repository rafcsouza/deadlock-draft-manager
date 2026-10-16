"use client"

import { useEffect, useRef, useState } from "react"
import type { ChatMessage } from "@/lib/draft-rules"

type Channel = "geral" | "time"

// Chat da sala com abas de chat geral e chat do time; as mensagens vêm do servidor.
export function RoomChat({
  messages,
  meId,
  inTeam,
  onSend,
}: {
  messages: Record<Channel, ChatMessage[]>
  meId: string
  inTeam: boolean
  onSend: (channel: Channel, text: string) => void
}) {
  const [channel, setChannel] = useState<Channel>("geral")
  const [text, setText] = useState("")
  const listRef = useRef<HTMLUListElement>(null)

  const visible = messages[channel]
  const canSend = channel === "geral" || inTeam

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [visible.length, channel])

  function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || !canSend) return
    onSend(channel, body)
    setText("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3 text-sm">
        {visible.map((m) => (
          <li key={m.id} className="break-words leading-snug">
            <span className={`font-semibold ${m.authorId === meId ? "text-foreground" : "text-foreground/80"}`}>
              {m.author}:{" "}
            </span>
            <span className="text-muted-foreground">{m.text}</span>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="pt-4 text-center text-xs text-muted-foreground">
            {canSend ? "Nenhuma mensagem ainda." : "Entre em um time para usar o chat do time."}
          </li>
        )}
      </ul>

      <form onSubmit={send} className="px-3 pb-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!canSend}
          maxLength={300}
          placeholder={canSend ? `Mensagem para ${channel === "geral" ? "todos" : "o time"}` : "Chat do time indisponível"}
          aria-label="Mensagem"
          className="w-full rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-muted-foreground/50 disabled:opacity-50"
        />
      </form>

      <div className="mx-3 mb-3 grid grid-cols-2 rounded-lg bg-muted/60 p-0.5 text-xs font-semibold" role="tablist">
        {(["time", "geral"] as const).map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={channel === c}
            onClick={() => setChannel(c)}
            className={`rounded-md py-1.5 transition-colors ${
              channel === c ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c === "time" ? "Chat do time" : "Chat geral"}
          </button>
        ))}
      </div>
    </div>
  )
}
