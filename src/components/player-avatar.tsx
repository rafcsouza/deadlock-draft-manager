"use client"

export type Player = { id: string; name: string; avatar?: string | null; bot?: boolean; guest?: boolean }

// Cor estável por jogador, derivada do nome.
function hue(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

// "Fictício 11" → "F11"; "Ana Lima" → "AL"; "jogador" → "JO".
function initials(name: string) {
  const [first = "", second] = name.split(" ")
  if (second && /^\d+$/.test(second)) return first[0] + second
  return second ? first[0] + second[0] : first.slice(0, 2)
}

type Props = {
  player: Player
  isMe?: boolean
  captain?: boolean
  // Dono da sala: ganha um selo de estrela no canto.
  host?: boolean
  selected?: boolean
  offline?: boolean
  draggable?: boolean
  onClick?: () => void
  hint?: string
}

// Quadrado com a foto (ou as iniciais) do jogador; o nome aparece ao passar o mouse.
export function PlayerAvatar({ player, isMe, captain, host, selected, offline, draggable, onClick, hint }: Props) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", player.id)}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      aria-label={player.name}
      className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold uppercase text-white transition-transform ${
        draggable ? "cursor-grab hover:-translate-y-0.5" : "cursor-default"
      } ${selected ? "ring-2 ring-foreground" : isMe ? "ring-2 ring-foreground/40" : ""} ${offline ? "opacity-40 grayscale" : ""}`}
      style={{ background: `hsl(${hue(player.name)} 35% 32%)` }}
    >
      {player.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.avatar} alt="" className="absolute inset-0 h-full w-full rounded-lg object-cover" />
      ) : (
        initials(player.name)
      )}
      {captain && <Crown className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2" />}
      {host && <HostBadge className="absolute -bottom-1.5 -right-1.5 h-5 w-5" />}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold normal-case text-background opacity-0 transition-opacity group-hover:opacity-100">
        {player.name}
        {isMe && " (você)"}
        {player.bot && " · fictício"}
        {player.guest && " · visitante"}
        {host && " · dono da sala"}
        {captain && " · Capitão"}
        {offline && " · offline"}
        {hint && <span className="block text-[10px] font-normal opacity-70">{hint}</span>}
      </span>
    </button>
  )
}

// Foto (ou iniciais) do jogador, sem interação.
function Face({ player, className }: { player: Player; className: string }) {
  return (
    <span
      className={`flex items-center justify-center overflow-hidden rounded-lg font-bold uppercase text-white ${className}`}
      style={{ background: `hsl(${hue(player.name)} 35% 32%)` }}
    >
      {player.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(player.name)
      )}
    </span>
  )
}

// Linha da sala de espera: avatar à esquerda e o nome escrito. action: rótulo à direita (ex.: "Escolher").
export function PlayerRow({
  player,
  isMe,
  host,
  selected,
  draggable,
  onClick,
  action,
}: {
  player: Player
  isMe?: boolean
  host?: boolean
  selected?: boolean
  draggable?: boolean
  onClick?: () => void
  action?: string
}) {
  const tags = [host && "dono da sala", player.bot && "fictício", player.guest && "visitante"].filter(Boolean).join(" · ")
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", player.id)}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
        onClick ? "hover:bg-muted" : "cursor-default"
      } ${draggable ? "cursor-grab" : ""} ${selected ? "bg-muted ring-1 ring-foreground/40" : ""}`}
    >
      <span className="relative shrink-0">
        <Face player={player} className="h-8 w-8 text-xs" />
        {host && <HostBadge className="absolute -bottom-1 -right-1 h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {player.name}
          {isMe && <span className="font-normal text-muted-foreground"> (você)</span>}
        </span>
        {tags && <span className="block truncate text-[11px] text-muted-foreground">{tags}</span>}
      </span>
      {action && <span className="bg-team-gradient shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold text-white">{action}</span>}
    </button>
  )
}

// Quadrado vazio do time. Com onJoin, vira um "+" para o jogador entrar com um clique.
export function EmptySlot({ captain, onJoin }: { captain?: boolean; onJoin?: () => void }) {
  const crown = captain && <Crown className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 opacity-30" />

  if (onJoin) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onJoin()
        }}
        aria-label={captain ? "Entrar como capitão" : "Entrar no time"}
        className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 bg-muted/40 text-xl text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        +
        {crown}
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold text-background opacity-0 transition-opacity group-hover:opacity-100">
          {captain ? "Entrar como capitão" : "Entrar no time"}
        </span>
      </button>
    )
  }

  return (
    <span className="relative h-11 w-11 shrink-0 rounded-lg border border-dashed border-border bg-muted/40">
      {crown}
    </span>
  )
}

function Crown({ className }: { className?: string }) {
  return (
    <svg className={`text-yellow-400 drop-shadow ${className}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" />
    </svg>
  )
}

// Selo do dono da sala: estrela dourada num círculo, no canto do avatar.
export function HostBadge({ className }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full border-2 border-card bg-yellow-400 text-background shadow ${className}`}
      aria-hidden="true"
    >
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z" />
      </svg>
    </span>
  )
}
