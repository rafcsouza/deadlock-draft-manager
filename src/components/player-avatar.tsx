export type Player = { id: string; name: string }

// Cor estável por jogador, derivada do nome.
function hue(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

function initials(name: string) {
  const [first = "", second = ""] = name.split(" ")
  return (first[0] ?? "") + (second[0] ?? "")
}

type Props = {
  player: Player
  isMe?: boolean
  captain?: boolean
  selected?: boolean
  draggable?: boolean
  onClick?: () => void
  hint?: string
}

// Quadrado com as iniciais do jogador; o nome aparece ao passar o mouse.
export function PlayerAvatar({ player, isMe, captain, selected, draggable, onClick, hint }: Props) {
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
      } ${selected ? "ring-2 ring-foreground" : isMe ? "ring-2 ring-foreground/40" : ""}`}
      style={{ background: `hsl(${hue(player.name)} 35% 32%)` }}
    >
      {initials(player.name)}
      {captain && <Crown className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2" />}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold normal-case text-background opacity-0 transition-opacity group-hover:opacity-100">
        {player.name}
        {isMe && " (você)"}
        {captain && " · Capitão"}
        {hint && <span className="block text-[10px] font-normal opacity-70">{hint}</span>}
      </span>
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

export function Crown({ className }: { className?: string }) {
  return (
    <svg className={`text-yellow-400 drop-shadow ${className}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" />
    </svg>
  )
}
