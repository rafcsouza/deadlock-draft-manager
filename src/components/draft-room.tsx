"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Logo } from "@/components/logo"
import { EmptySlot, PlayerAvatar, type Player } from "@/components/player-avatar"
import { RoomChat } from "@/components/room-chat"
import type { Hero } from "@/lib/heroes"
import { useFitGrid } from "@/lib/use-fit-grid"

type Team = "a" | "b"
type Step = { team: Team; action: "ban" | "pick" }

const TEAMS: Record<Team, { name: string; color: string }> = {
  a: { name: "Hidden King", color: "var(--team-a)" },
  b: { name: "Archmother", color: "var(--team-b)" },
}

const TEAM_SIZE = 6
const HERO_GAP = 6

// Formato padrão: "a#" = ban do time A, "b2" = 2 picks do time B, etc.
const ORDER = "a#-b#-a1-b2-a2-b1-b#-a#-b1-a2-b2-a1"

const STEPS: Step[] = ORDER.split("-").flatMap((turn): Step[] => {
  const team = turn[0] as Team
  if (turn[1] === "#") return [{ team, action: "ban" }]
  return Array.from({ length: Number(turn.slice(1)) }, () => ({ team, action: "pick" }))
})

const slotsFor = (team: Team, action: Step["action"]) =>
  STEPS.filter((s) => s.team === team && s.action === action).length

const randomName = () => `Jogador ${Math.floor(1000 + Math.random() * 9000)}`

// Sala de draft: 1) sala de espera + chat, 2) heróis, 3) times (o primeiro
// jogador de cada time é o capitão), 4) bans de cada time, 5) de quem é a vez.
// Por enquanto o estado vive só neste navegador; a sincronização em tempo
// real entre jogadores ainda será feita.
export function DraftRoom({ heroes }: { heroes: Hero[] }) {
  const [me, setMe] = useState<Player | null>(null)
  const [lobby, setLobby] = useState<Player[]>([])
  const [teams, setTeams] = useState<Record<Team, Player[]>>({ a: [], b: [] })
  const [selected, setSelected] = useState<string | null>(null)
  const [actions, setActions] = useState<Hero[]>([])
  const { ref: heroArea, grid: heroGrid } = useFitGrid<HTMLDivElement>(heroes.length, 3 / 4, HERO_GAP)

  // Gerado no cliente para não divergir da renderização do servidor.
  useEffect(() => {
    const player = { id: "me", name: randomName() }
    setMe(player)
    setLobby([player])
  }, [])

  const ready = teams.a.length > 0 && teams.b.length > 0
  const started = actions.length > 0
  const finished = actions.length === STEPS.length
  const current = ready && !finished ? STEPS[actions.length] : null
  const myTeam = (["a", "b"] as const).find((t) => teams[t].some((p) => p.id === me?.id)) ?? null

  const chosen = (team: Team, action: Step["action"]) =>
    actions.filter((_, i) => STEPS[i].team === team && STEPS[i].action === action)
  const statusOf = (hero: Hero) => {
    const i = actions.findIndex((h) => h.id === hero.id)
    return i === -1 ? null : STEPS[i]
  }

  function choose(hero: Hero) {
    if (!current || statusOf(hero)) return
    setActions([...actions, hero])
  }

  // Move um jogador entre a sala de espera e os times.
  function move(playerId: string | null, to: Team | "lobby") {
    if (started || !playerId) return
    const player = [...lobby, ...teams.a, ...teams.b].find((p) => p.id === playerId)
    if (!player) return
    if (to !== "lobby" && (teams[to].length >= TEAM_SIZE || teams[to].includes(player))) return

    const without = (list: Player[]) => list.filter((p) => p.id !== playerId)
    const next = { a: without(teams.a), b: without(teams.b) }
    if (to === "lobby") {
      setLobby([...without(lobby), player])
    } else {
      next[to] = [...next[to], player]
      setLobby(without(lobby))
    }
    setTeams(next)
    setSelected(null)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 lg:h-screen lg:flex-row lg:p-6">
      {/* 1. Sala de espera (metade de cima) e chat (metade de baixo) */}
      <aside className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 lg:w-64 lg:shrink-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link href="/" aria-label="Voltar para o início">
            <Logo className="h-5 w-5" />
          </Link>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider">Sala de espera</h2>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {lobby.length}
          </span>
          <CopyLinkButton />
        </div>

        <div
          onDragOver={(e) => !started && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            move(e.dataTransfer.getData("text/plain"), "lobby")
          }}
          className="flex min-h-40 flex-col lg:min-h-0 lg:flex-1 lg:basis-0"
        >
          <div className="flex flex-1 flex-wrap content-start gap-2 overflow-y-auto p-4 pb-10">
            {lobby.map((p) => (
              <PlayerAvatar
                key={p.id}
                player={p}
                isMe={p.id === me?.id}
                selected={selected === p.id}
                draggable={!started}
                onClick={() => !started && setSelected(selected === p.id ? null : p.id)}
              />
            ))}
            {/* Provisório: simula outros jogadores enquanto a sala não é em tempo real. */}
            {!started && (
              <button
                onClick={() => setLobby([...lobby, { id: crypto.randomUUID(), name: randomName() }])}
                title="Adicionar jogador de teste"
                aria-label="Adicionar jogador de teste"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-border text-lg text-muted-foreground hover:text-foreground"
              >
                +
              </button>
            )}
          </div>
          <p className="px-4 pb-3 text-[11px] leading-snug text-muted-foreground">
            Clique no + de um time para entrar, ou arraste jogadores até ele. O primeiro de cada time é o capitão.
          </p>
        </div>

        <div className="flex h-80 flex-col border-t border-border lg:h-auto lg:min-h-0 lg:flex-1 lg:basis-0">
          <RoomChat me={me} myTeam={myTeam} />
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {(["a", "b"] as const).map((team) => (
            <div key={team} className="space-y-2">
              {/* 4. Bans do time */}
              <BanStrip team={team} bans={chosen(team, "ban")} />
              {/* 3. Time, com o capitão no primeiro quadrado */}
              <TeamCard
                team={team}
                players={teams[team]}
                meId={me?.id}
                picks={chosen(team, "pick")}
                active={current?.team === team}
                locked={started}
                canAssign={selected !== null}
                onAdd={(playerId) => move(playerId ?? selected, team)}
                onRemove={(playerId) => move(playerId, "lobby")}
              />
            </div>
          ))}
        </div>

        {/* 2. Heróis */}
        <section className="flex h-[75svh] min-h-0 flex-col rounded-2xl border border-border bg-card/80 lg:h-auto lg:flex-1">
          {/* 5. De quem é a vez */}
          <div className="flex h-16 shrink-0 items-center justify-center border-b border-border px-4">
            <TurnBanner current={current} ready={ready} finished={finished} actions={actions.length} />
          </div>
          {/* Os cards são dimensionados para todos caberem na área, sem rolagem. */}
          <div ref={heroArea} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
            <div
              className="grid"
              style={{
                gap: HERO_GAP,
                gridTemplateColumns: heroGrid ? `repeat(${heroGrid.columns}, ${heroGrid.width}px)` : undefined,
                visibility: heroGrid ? "visible" : "hidden",
              }}
            >
              {heroes.map((h) => {
                const status = statusOf(h)
                const clickable = current !== null && status === null
                return (
                  <button
                    key={h.id}
                    onClick={() => choose(h)}
                    disabled={!clickable}
                    title={h.name}
                    className={`relative aspect-[3/4] overflow-hidden rounded-lg border-b-2 bg-muted transition-transform ${
                      clickable ? "cursor-pointer hover:-translate-y-0.5 hover:brightness-110" : "cursor-default"
                    }`}
                    style={{
                      borderColor: h.color,
                      outline: status?.action === "pick" ? `2px solid ${TEAMS[status.team].color}` : undefined,
                      outlineOffset: -2,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={h.card}
                      alt={h.name}
                      className={`h-full w-full object-cover ${
                        status?.action === "ban" ? "opacity-30 grayscale" : status ? "opacity-60" : ""
                      }`}
                    />
                    {/* Em cards muito pequenos o nome não caberia; fica no tooltip. */}
                    {heroGrid && heroGrid.width >= 52 && (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1 pb-1 pt-4 text-center text-[10px] font-bold leading-tight text-white">
                        {h.name}
                      </span>
                    )}
                    {status?.action === "ban" && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-white">
                          BAN
                        </span>
                      </span>
                    )}
                  </button>
                )
              })}
              {heroes.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                  Não foi possível carregar os heróis agora.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function TurnBanner({
  current,
  ready,
  finished,
  actions,
}: {
  current: Step | null
  ready: boolean
  finished: boolean
  actions: number
}) {
  if (finished) {
    return <span className="font-display text-lg font-bold uppercase tracking-wider">Draft finalizado</span>
  }
  if (!ready || !current) {
    return (
      <span className="text-sm text-muted-foreground">Defina os dois capitães para começar o draft</span>
    )
  }

  // Quantas ações seguidas iguais o time ainda tem neste turno (ex.: 2 picks).
  let count = 0
  while (STEPS[actions + count]?.team === current.team && STEPS[actions + count]?.action === current.action) {
    count++
  }
  const { name, color } = TEAMS[current.team]
  const verb =
    current.action === "ban" ? "bane um herói" : `escolhe ${count === 1 ? "um herói" : `${count} heróis`}`

  return (
    <span
      className="rounded-full border px-5 py-1.5 font-display text-lg font-bold uppercase tracking-wider"
      style={{ borderColor: color, color }}
    >
      {name} <span className="text-foreground">{verb}</span>
    </span>
  )
}

function BanStrip({ team, bans }: { team: Team; bans: Hero[] }) {
  const slots = slotsFor(team, "ban")
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bans</span>
      {Array.from({ length: slots }, (_, i) => (
        <HeroIcon key={i} hero={bans[i]} banned />
      ))}
    </div>
  )
}

function HeroIcon({ hero, banned }: { hero?: Hero; banned?: boolean }) {
  if (!hero) {
    return <span className="h-9 w-9 rounded-md border border-dashed border-border bg-muted/40" />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={hero.card}
      alt={hero.name}
      title={hero.name}
      className={`h-9 w-9 rounded-md object-cover object-top ${banned ? "border border-red-600/70 grayscale" : ""}`}
    />
  )
}

function TeamCard({
  team,
  players,
  meId,
  picks,
  active,
  locked,
  canAssign,
  onAdd,
  onRemove,
}: {
  team: Team
  players: Player[]
  meId?: string
  picks: Hero[]
  active: boolean
  locked: boolean
  canAssign: boolean
  onAdd: (playerId?: string) => void
  onRemove: (playerId: string) => void
}) {
  const [over, setOver] = useState(false)
  const { name, color } = TEAMS[team]
  const assignable = canAssign && !locked && players.length < TEAM_SIZE

  return (
    <div
      onDragOver={(e) => {
        if (locked) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onAdd(e.dataTransfer.getData("text/plain"))
      }}
      onClick={() => assignable && onAdd()}
      className={`relative rounded-2xl border bg-card/80 px-4 pb-4 pt-3 transition-colors ${
        assignable ? "cursor-pointer" : ""
      }`}
      style={{
        borderColor: over || assignable || active ? color : "var(--border)",
        boxShadow: active ? `0 0 24px -6px ${color}` : undefined,
      }}
    >
      <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: color }} />
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
          {name}
        </p>
        <span className="text-[11px] text-muted-foreground">
          {players.length}/{TEAM_SIZE}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: TEAM_SIZE }, (_, i) =>
          players[i] ? (
            <PlayerAvatar
              key={players[i].id}
              player={players[i]}
              isMe={players[i].id === meId}
              captain={i === 0}
              draggable={!locked}
              onClick={() => !locked && onRemove(players[i].id)}
              hint={locked ? undefined : "Clique para devolver à sala de espera"}
            />
          ) : (
            <EmptySlot
              key={i}
              captain={i === 0}
              // Só o próximo quadrado livre recebe o "+", e só se você ainda não está neste time.
              onJoin={!locked && meId && i === players.length && !players.some((p) => p.id === meId) ? () => onAdd(meId) : undefined}
            />
          ),
        )}
      </div>
      {/* Sempre visível (mesmo vazia) para o layout não mudar de altura quando o draft começa. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="mr-1 self-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Picks
        </span>
        {Array.from({ length: slotsFor(team, "pick") }, (_, i) => (
          <HeroIcon key={i} hero={picks[i]} />
        ))}
      </div>
    </div>
  )
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      title="Copiar link da sala"
      aria-label={copied ? "Link copiado" : "Copiar link da sala"}
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-transform hover:-translate-y-0.5"
      style={{ background: "linear-gradient(135deg, var(--team-a) 0%, var(--team-b) 100%)" }}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {copied ? (
          <path d="M5 12l5 5 9-10" />
        ) : (
          <>
            <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
            <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
          </>
        )}
      </svg>
      {copied && (
        <span className="absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold text-background">
          Link copiado!
        </span>
      )}
    </button>
  )
}
