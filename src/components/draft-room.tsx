"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CoinFlip } from "@/components/coin-flip"
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
// Tempo por turno (pick ou ban), em segundos.
const TURN_MIN = 30
const TURN_MAX = 180

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
  const [first, setFirst] = useState<Team | null>(null)
  const [turnSeconds, setTurnSeconds] = useState(TURN_MIN)
  const [remaining, setRemaining] = useState(TURN_MIN)
  const { ref: heroArea, grid: heroGrid } = useFitGrid<HTMLDivElement>(heroes.length, 3 / 4, HERO_GAP)

  // Gerado no cliente para não divergir da renderização do servidor.
  useEffect(() => {
    const player = { id: "me", name: randomName() }
    setMe(player)
    setLobby([player])
  }, [])

  // Pré-carrega os retratos de ban e pick para a troca ser instantânea no clique.
  useEffect(() => {
    for (const h of heroes) {
      new Image().src = h.critical
      new Image().src = h.gloat
    }
  }, [heroes])

  // Ordem do draft a partir do time que venceu o cara ou coroa (ORDER assume o time A começando).
  const steps = useMemo(
    () => (first === "b" ? STEPS.map((s) => ({ ...s, team: s.team === "a" ? ("b" as const) : ("a" as const) })) : STEPS),
    [first],
  )

  const hasCaptains = teams.a.length > 0 && teams.b.length > 0
  // Depois do cara ou coroa os times ficam travados.
  const started = first !== null
  const finished = actions.length === steps.length
  const current = started && !finished ? steps[actions.length] : null
  const myTeam = (["a", "b"] as const).find((t) => teams[t].some((p) => p.id === me?.id)) ?? null

  const chosen = (team: Team, action: Step["action"]) =>
    actions.filter((_, i) => steps[i].team === team && steps[i].action === action)
  const statusOf = (hero: Hero) => {
    const i = actions.findIndex((h) => h.id === hero.id)
    return i === -1 ? null : steps[i]
  }

  function choose(hero: Hero) {
    if (!current || statusOf(hero)) return
    setActions([...actions, hero])
  }

  // Timer do turno: reinicia a cada ação; ao zerar, escolhe um herói aleatório pelo time.
  const turnKey = current ? actions.length : -1
  useEffect(() => {
    if (turnKey < 0) return
    setRemaining(turnSeconds)
    const id = window.setInterval(() => setRemaining((r) => r - 1), 1000)
    return () => window.clearInterval(id)
  }, [turnKey, turnSeconds])

  useEffect(() => {
    if (!current || remaining > 0) return
    const available = heroes.filter((h) => !statusOf(h))
    if (available.length > 0) choose(available[Math.floor(Math.random() * available.length)])
    // Só reage ao tempo zerando; as demais dependências são lidas no momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  // Mantém os times e volta para o cara ou coroa.
  function restart() {
    setActions([])
    setFirst(null)
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
          <div className="relative flex h-16 shrink-0 items-center justify-center border-b border-border px-14">
            <TimerSettings
              value={turnSeconds}
              onChange={setTurnSeconds}
              locked={actions.length > 0}
            />
            {hasCaptains && !started ? (
              <CoinFlip
                sides={{ a: { ...TEAMS.a, letter: "H" }, b: { ...TEAMS.b, letter: "A" } }}
                onResult={setFirst}
              />
            ) : (
              <TurnBanner
                steps={steps}
                current={current}
                finished={finished}
                actions={actions.length}
                remaining={remaining}
                onRestart={restart}
              />
            )}
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
                    // Disponível: sem cor; ao passar o mouse, cresce em relevo e ganha a cor do herói.
                    className={`group relative aspect-[3/4] overflow-hidden rounded-lg border-b-2 bg-muted transition-[transform,box-shadow,border-color] duration-200 ${
                      status
                        ? ""
                        : "border-border hover:z-10 hover:scale-110 hover:border-[var(--hero-color)] hover:shadow-xl hover:shadow-black/70"
                    } ${clickable ? "cursor-pointer" : "cursor-default"}`}
                    style={
                      {
                        "--hero-color": h.color,
                        borderColor: status ? h.color : undefined,
                        outline: status?.action === "pick" ? `2px solid ${TEAMS[status.team].color}` : undefined,
                        outlineOffset: -2,
                      } as React.CSSProperties
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={portrait(h, status?.action)}
                      alt={h.name}
                      // Disponível: cinza, ganha cor ao passar o mouse. Banido/escolhido: retrato do estado, colorido.
                      className={`h-full w-full object-cover transition-[filter] duration-200 ${
                        status?.action === "ban" ? "opacity-60" : status ? "" : "grayscale group-hover:grayscale-0"
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
  steps,
  current,
  finished,
  actions,
  remaining,
  onRestart,
}: {
  steps: Step[]
  current: Step | null
  finished: boolean
  actions: number
  remaining: number
  onRestart: () => void
}) {
  if (finished) {
    return (
      <div className="flex items-center gap-4">
        <span className="font-display text-lg font-bold uppercase tracking-wider">Draft finalizado</span>
        <button
          onClick={onRestart}
          className="rounded-full border border-border bg-muted px-5 py-2 font-display text-sm font-bold uppercase tracking-wider transition-colors hover:border-muted-foreground"
        >
          Reiniciar draft
        </button>
      </div>
    )
  }
  if (!current) {
    return (
      <span className="text-sm text-muted-foreground">Defina os dois capitães para começar o draft</span>
    )
  }

  // Quantas ações seguidas iguais o time ainda tem neste turno (ex.: 2 picks).
  let count = 0
  while (steps[actions + count]?.team === current.team && steps[actions + count]?.action === current.action) {
    count++
  }
  const { name, color } = TEAMS[current.team]
  const verb =
    current.action === "ban" ? "bane um herói" : `escolhe ${count === 1 ? "um herói" : `${count} heróis`}`

  const seconds = Math.max(remaining, 0)
  return (
    <div className="flex items-center gap-3">
      <span
        className="rounded-full border px-5 py-1.5 font-display text-lg font-bold uppercase tracking-wider"
        style={{ borderColor: color, color }}
      >
        {name} <span className="text-foreground">{verb}</span>
      </span>
      <span
        className={`w-14 rounded-full border px-2 py-1.5 text-center font-mono text-sm font-bold tabular-nums ${
          seconds <= 10 ? "border-red-600/70 text-red-400" : "border-border text-muted-foreground"
        }`}
        aria-label={`${seconds} segundos restantes`}
      >
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </span>
    </div>
  )
}

function TimerSettings({
  value,
  onChange,
  locked,
}: {
  value: number
  onChange: (seconds: number) => void
  locked: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    // Sem transform aqui: ele prenderia o menu atrás dos cards e limitaria o fundo "fixed" de fechar.
    <div className="absolute inset-y-0 right-3 z-30 flex items-center">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Configurações do draft"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-border bg-card p-3 shadow-2xl shadow-black/60">
            <div className="flex items-baseline justify-between">
              <label htmlFor="turn-time" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Tempo por turno
              </label>
              <span className="font-mono text-sm font-bold tabular-nums">{value}s</span>
            </div>
            <input
              id="turn-time"
              type="range"
              min={TURN_MIN}
              max={TURN_MAX}
              step={5}
              value={value}
              disabled={locked}
              onChange={(e) => onChange(Number(e.target.value))}
              className="mt-3 w-full cursor-pointer accent-[var(--team-a)] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{TURN_MIN}s</span>
              <span>{TURN_MAX}s</span>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {locked
                ? "O draft já começou; o tempo não pode mais ser alterado."
                : "Vale para cada pick e ban. Só pode ser alterado antes da primeira escolha."}
            </p>
          </div>
        </>
      )}
    </div>
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

// Retrato conforme o estado: vida baixa quando banido, "on fire" quando escolhido.
function portrait(hero: Hero, action?: Step["action"]) {
  if (action === "ban") return hero.critical
  if (action === "pick") return hero.gloat
  return hero.card
}

function HeroIcon({ hero, banned }: { hero?: Hero; banned?: boolean }) {
  if (!hero) {
    return <span className="h-9 w-9 rounded-md border border-dashed border-border bg-muted/40" />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // Na faixa de bans usa o retrato de vida baixa; nos picks do time, o card padrão.
      src={banned ? portrait(hero, "ban") : hero.card}
      alt={hero.name}
      title={hero.name}
      className={`h-9 w-9 rounded-md object-cover object-top ${banned ? "border border-red-600/70" : ""}`}
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
