"use client"

import { useEffect, useRef, useState } from "react"
import { CHAT_IMAGE_MAX_BYTES, TEAM_COLORS, type ChatMessage, type Team } from "@/lib/draft-rules"

type Channel = "geral" | "time"

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
// Link direto de imagem ou GIF (ex.: copiado do Tenor ou do Giphy): vira imagem no chat.
const IMAGE_URL = /^https:\/\/\S+\.(?:gif|png|jpe?g|webp)(?:\?\S*)?$/i

// Chat da sala: mensagens gerais e do seu time numa lista só (as do time destacadas),
// com a escolha de para quem mandar. Aceita imagens e GIFs (anexo, Ctrl+V ou link direto).
// Nada disso é salvo: fica na memória da sala e some quando ela fecha.
export function RoomChat({
  code,
  messages,
  meId,
  myTeam,
  onSend,
}: {
  code: string
  messages: ChatMessage[]
  meId: string
  myTeam: Team | null
  onSend: (channel: Channel, text: string, image?: string) => void
}) {
  const [channel, setChannel] = useState<Channel>("geral")
  const [text, setText] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Saiu do time: volta a mandar no chat geral.
  useEffect(() => {
    if (!myTeam) setChannel("geral")
  }, [myTeam])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length])

  function attach(file: File | null | undefined) {
    setError(null)
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) return setError("Só imagens PNG, JPG, WEBP ou GIF.")
    if (file.size > CHAT_IMAGE_MAX_BYTES) return setError("Imagem muito grande (máximo 3 MB).")
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result))
    reader.readAsDataURL(file)
  }

  function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body && !image) return
    onSend(channel, body, image ?? undefined)
    setText("")
    setImage(null)
    setError(null)
  }

  const teamColor = myTeam ? TEAM_COLORS[myTeam] : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3 text-sm">
        {messages.map((m) => (
          <Message key={m.id} message={m} code={code} mine={m.authorId === meId} />
        ))}
        {messages.length === 0 && <li className="pt-4 text-center text-xs text-muted-foreground">Nenhuma mensagem ainda.</li>}
      </ul>

      <form onSubmit={send} className="space-y-1.5 px-3 pb-3">
        {image && (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Imagem a enviar" className="max-h-24 rounded-md border border-border" />
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label="Remover imagem"
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-[10px] text-white"
            >
              ✕
            </button>
          </div>
        )}
        {error && <p className="text-[11px] text-red-300">{error}</p>}

        {/* Para quem vai a mensagem: todos ou só o seu time. */}
        <div className="grid grid-cols-2 rounded-lg bg-muted/60 p-0.5 text-[11px] font-semibold">
          {(["geral", "time"] as const).map((c) => (
            <button
              key={c}
              type="button"
              disabled={c === "time" && !myTeam}
              onClick={() => setChannel(c)}
              title={c === "time" && !myTeam ? "Entre em um time para usar o chat do time" : undefined}
              className={`rounded-md py-1 transition-colors disabled:opacity-40 ${
                channel === c ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
              style={channel === c && c === "time" ? { color: teamColor } : undefined}
            >
              {c === "geral" ? "Para todos" : "Só meu time"}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            // Colar uma imagem (Ctrl+V) anexa direto.
            onPaste={(e) => {
              const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"))
              if (file) {
                e.preventDefault()
                attach(file)
              }
            }}
            maxLength={300}
            placeholder={channel === "geral" ? "Mensagem para todos" : "Mensagem para o time"}
            aria-label="Mensagem"
            className="min-w-0 flex-1 rounded-lg border bg-muted/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-muted-foreground/50"
            style={{ borderColor: channel === "time" ? teamColor : "var(--border)" }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Enviar imagem ou GIF"
            aria-label="Enviar imagem ou GIF"
            className="flex w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            hidden
            onChange={(e) => {
              attach(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </div>
      </form>
    </div>
  )
}

function Message({ message: m, code, mine }: { message: ChatMessage; code: string; mine: boolean }) {
  const team = m.channel === "time" ? m.team : undefined
  const linkImage = IMAGE_URL.test(m.text) ? m.text : null
  return (
    <li
      className={`break-words leading-snug ${team ? "rounded-md border-l-2 py-1 pl-2" : ""}`}
      style={team ? { borderColor: TEAM_COLORS[team], background: `color-mix(in oklab, ${TEAM_COLORS[team]} 10%, transparent)` } : undefined}
    >
      {team && (
        <span className="mr-1.5 rounded px-1 py-px text-[9px] font-black uppercase tracking-wider text-black" style={{ background: TEAM_COLORS[team] }}>
          Time
        </span>
      )}
      <span className={`font-semibold ${mine ? "text-foreground" : "text-foreground/80"}`}>{m.author}: </span>
      {!linkImage && m.text && <span className="text-muted-foreground">{m.text}</span>}
      {m.imageId && <ChatImage src={`/api/rooms/${code}/images/${m.imageId}`} />}
      {linkImage && <ChatImage src={linkImage} />}
    </li>
  )
}

function ChatImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className="block text-[11px] italic text-muted-foreground">(imagem expirada)</span>
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="mt-1 block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Imagem do chat" loading="lazy" onError={() => setFailed(true)} className="max-h-40 max-w-full rounded-md" />
    </a>
  )
}
