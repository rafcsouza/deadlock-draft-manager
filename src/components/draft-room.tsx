"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { CoinFlip } from "@/components/coin-flip"
import { Logo } from "@/components/logo"
import { MatchResultPanel } from "@/components/match-result"
import { EmptySlot, PlayerAvatar } from "@/components/player-avatar"
import { RoomChat } from "@/components/room-chat"
import {
  buildSteps,
  COIN_TOTAL_MS,
  slotsFor,
  TEAM_NAMES,
  TEAM_SIZE,
  TOTAL_STEPS,
  TURN_MAX,
  TURN_MIN,
  TURN_STEP,
  type PlayerView,
  type RoomView,
  type Step,
  type Team,
} from "@/lib/draft-rules"
import type { Hero } from "@/lib/heroes"
import { useFitGrid } from "@/lib/use-fit-grid"
import { useRoom, useServerClock } from "@/lib/use-room"

const TEAMS: Record<Team, { name: string; color: string }> = {
  a: { name: TEAM_NAMES.a, color: "var(--team-a)" },
  b: { name: TEAM_NAMES.b, color: "var(--team-b)" },
}

const HERO_GAP = 6

// Sala de draft: 1) sala de espera + chat, 2) heróis, 3) times (o primeiro
// jogador de cada time é o capitão), 4) bans de cada time, 5) de quem é a vez.
// O estado vem do servidor em tempo real; aqui só mostramos e enviamos ações.
export function DraftRoom({ code, heroes, meId }: { code: string; heroes: Hero[]; meId: string }) {
  const room = useRoom(code)
  if (!room.view) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Conectando à sala...
      </main>
    )
  }
  return <RoomScreen {...room} view={room.view} heroes={heroes} meId={meId} />
}

type RoomScreenProps = Omit<ReturnType<typeof useRoom>, "view"> & { view: RoomView; heroes: Hero[]; meId: string }

// Separado do DraftRoom para os hooks (ex.: medir a grade de heróis) rodarem só com a sala já carregada.
function RoomScreen({ view, connected, error, send, serverNow, heroes, meId }: RoomScreenProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const { ref: heroArea, grid: heroGrid } = useFitGrid<HTMLDivElement>(heroes.length, 3 / 4, HERO_GAP)
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes])

  // Pré-carrega os retratos de ban e pick para a troca ser instantânea.
  useEffect(() => {
    for (const h of heroes) {
      new Image().src = h.critical
      new Image().src = h.gloat
    }
  }, [heroes])

  const now = useServerClock(serverNow, Boolean(view.deadline || view.coinAt))

  const teams = view.teams
  const actions = view.actions
  const steps = buildSteps(view.first)
  const hasCaptains = teams.a.length > 0 && teams.b.length > 0
  const started = Boolean(view.first)
  const finished = actions.length === TOTAL_STEPS
  const coinPhase = view.coinAt !== null && now < view.coinAt + COIN_TOTAL_MS
  const current = started && !finished && !coinPhase ? steps[actions.length] : null
  const remaining = view.deadline ? Math.ceil((view.deadline - now) / 1000) : 0

  const myTeam = (["a", "b"] as const).find((t) => teams[t].some((p) => p.id === meId)) ?? null
  const captainTeam = (["a", "b"] as const).find((t) => teams[t][0]?.id === meId) ?? null
  const isHost = view.hostId === meId
  // Quem joga pelo time: o capitão, ou o anfitrião quando o capitão é um jogador fictício.
  const actsFor = (team: Team) => {
    const captain = teams[team][0]
    return Boolean(captain && (captain.id === meId || (isHost && captain.bot)))
  }
  const selectedIsBot = view.lobby.some((p) => p.id === selected && p.bot)
  const canManage = isHost || captainTeam !== null

  const heroesOf = (team: Team, action: Step["action"]) =>
    actions
      .filter((_, i) => steps[i].team === team && steps[i].action === action)
      .map((id) => heroById.get(id))
      .filter((h): h is Hero => Boolean(h))
  const statusOf = (hero: Hero) => {
    const i = actions.indexOf(hero.id)
    return i === -1 ? null : steps[i]
  }

  const move = (playerId: string | null | undefined, to: Team | "lobby") => {
    setSelected(null)
    if (playerId && !started) send({ type: "move", playerId, to })
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
            {view.lobby.length}
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
            {view.lobby.map((p) => {
              // Você pode se arrastar; capitães podem arrastar qualquer um da sala de espera.
              // Anfitrião também move os jogadores fictícios.
              const movable = !started && (p.id === meId || captainTeam !== null || (isHost && p.bot))
              return (
                <PlayerAvatar
                  key={p.id}
                  player={p}
                  isMe={p.id === meId}
                  selected={selected === p.id}
                  draggable={movable}
                  onClick={() => movable && setSelected(selected === p.id ? null : p.id)}
                />
              )
            })}
            {/* Jogadores fictícios para testes (só o anfitrião adiciona). */}
            {isHost && !started && (
              <button
                onClick={() => send({ type: "addBot" })}
                title="Adicionar jogador fictício"
                aria-label="Adicionar jogador fictício"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-border text-lg text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                +
              </button>
            )}
            {view.lobby.length === 0 && !isHost && (
              <p className="w-full pt-4 text-center text-xs text-muted-foreground">Ninguém aguardando.</p>
            )}
          </div>
          <p className="px-4 pb-3 text-[11px] leading-snug text-muted-foreground">
            Clique no + de um time para entrar. O primeiro de cada time é o capitão e pode puxar jogadores para o time.
            {isHost && " Como anfitrião, use o + aqui para criar jogadores fictícios e testar."}
          </p>
        </div>

        <div className="flex h-80 flex-col border-t border-border lg:h-auto lg:min-h-0 lg:flex-1 lg:basis-0">
          <RoomChat
            messages={view.chat}
            meId={meId}
            inTeam={myTeam !== null}
            onSend={(channel, text) => send({ type: "chat", channel, text })}
          />
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {(["a", "b"] as const).map((team) => (
            <div key={team} className="space-y-2">
              {/* 4. Bans do time */}
              <BanStrip team={team} bans={heroesOf(team, "ban")} />
              {/* 3. Time, com o capitão no primeiro quadrado */}
              <TeamCard
                team={team}
                players={teams[team]}
                meId={meId}
                isCaptain={captainTeam === team}
                isHost={isHost}
                picks={heroesOf(team, "pick")}
                active={current?.team === team}
                locked={started}
                canAssign={selected !== null && (captainTeam === team || (isHost && selectedIsBot))}
                onAdd={(playerId) => move(playerId ?? selected, team)}
                onRemove={(playerId) => move(playerId, "lobby")}
              />
            </div>
          ))}
        </div>

        {/* 2. Heróis */}
        <section className="relative flex h-[75svh] min-h-0 flex-col rounded-2xl border border-border bg-card/80 lg:h-auto lg:flex-1">
          {/* 5. De quem é a vez */}
          <div className="relative flex h-16 shrink-0 items-center justify-center border-b border-border px-14">
            <TimerSettings
              value={view.turnSeconds}
              onChange={(seconds) => send({ type: "turnSeconds", seconds })}
              locked={!canManage || actions.length > 0}
              reason={
                actions.length > 0
                  ? "O draft já começou; o tempo não pode mais ser alterado."
                  : !canManage
                    ? "Só o anfitrião da sala ou os capitães podem mudar o tempo."
                    : "Vale para cada pick e ban. Só pode ser alterado antes da primeira escolha."
              }
            />
            {hasCaptains && (!started || coinPhase) ? (
              <CoinFlip
                sides={{ a: { ...TEAMS.a, letter: "H" }, b: { ...TEAMS.b, letter: "A" } }}
                result={view.first}
                coinAt={view.coinAt}
                now={now}
                canFlip={actsFor("a") || actsFor("b")}
                onFlip={() => send({ type: "flip" })}
              />
            ) : (
              <TurnBanner
                steps={steps}
                current={current}
                finished={finished}
                actions={actions.length}
                remaining={remaining}
                myTurn={current !== null && actsFor(current.team)}
                canRestart={canManage}
                onRestart={() => send({ type: "restart" })}
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
                const clickable = current !== null && actsFor(current.team) && status === null
                return (
                  <button
                    key={h.id}
                    onClick={() => clickable && send({ type: "choose", heroId: h.id })}
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
          {/* Depois do draft: informar o ID da partida e confirmar os stats (por cima da grade). */}
          {finished && (
            <div className="absolute inset-x-0 bottom-0 top-16 z-20 rounded-b-2xl bg-card/95 p-4 backdrop-blur">
              <MatchResultPanel
                result={view.result}
                fetching={view.fetchingResult}
                savedDraftId={view.savedDraftId}
                canManage={canManage}
                heroes={heroById}
                send={send}
              />
            </div>
          )}
        </section>
      </div>

      {/* Avisos: erro de uma ação e conexão caída. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {!connected && (
          <span className="rounded-lg border border-yellow-600/50 bg-card px-4 py-2 text-sm text-yellow-300 shadow-xl">
            Reconectando à sala...
          </span>
        )}
        {error && (
          <span role="alert" className="rounded-lg border border-red-600/50 bg-card px-4 py-2 text-sm text-red-300 shadow-xl">
            {error}
          </span>
        )}
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
  myTurn,
  canRestart,
  onRestart,
}: {
  steps: Step[]
  current: Step | null
  finished: boolean
  actions: number
  remaining: number
  myTurn: boolean
  canRestart: boolean
  onRestart: () => void
}) {
  if (finished) {
    return (
      <div className="flex items-center gap-4">
        <span className="font-display text-lg font-bold uppercase tracking-wider">Draft finalizado</span>
        {canRestart && (
          <button
            onClick={onRestart}
            className="rounded-full border border-border bg-muted px-5 py-2 font-display text-sm font-bold uppercase tracking-wider transition-colors hover:border-muted-foreground"
          >
            Reiniciar draft
          </button>
        )}
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
        {myTurn ? "Sua vez: " : `${name} `}
        <span className="text-foreground">{verb}</span>
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
  reason,
}: {
  value: number
  onChange: (seconds: number) => void
  locked: boolean
  reason: string
}) {
  const [open, setOpen] = useState(false)
  // Valor local enquanto arrasta; envia ao servidor só quando o slider para.
  const [draft, setDraft] = useState(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value || locked) return
    const id = window.setTimeout(() => onChangeRef.current(draft), 300)
    return () => window.clearTimeout(id)
  }, [draft, value, locked])

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
              <span className="font-mono text-sm font-bold tabular-nums">{draft}s</span>
            </div>
            <input
              id="turn-time"
              type="range"
              min={TURN_MIN}
              max={TURN_MAX}
              step={TURN_STEP}
              value={draft}
              disabled={locked}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="mt-3 w-full cursor-pointer accent-[var(--team-a)] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{TURN_MIN}s</span>
              <span>{TURN_MAX}s</span>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{reason}</p>
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
  isCaptain,
  isHost,
  picks,
  active,
  locked,
  canAssign,
  onAdd,
  onRemove,
}: {
  team: Team
  players: PlayerView[]
  meId: string
  isCaptain: boolean
  isHost: boolean
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
        {Array.from({ length: TEAM_SIZE }, (_, i) => {
          const p = players[i]
          if (!p) {
            return (
              <EmptySlot
                // Prefixos evitam colisão entre a posição do quadrado vazio e o ID de um jogador (ex.: "1").
                key={`vazio-${i}`}
                captain={i === 0}
                // Só o próximo quadrado livre recebe o "+", e só se você ainda não está neste time.
                onJoin={!locked && i === players.length && !players.some((x) => x.id === meId) ? () => onAdd(meId) : undefined}
              />
            )
          }
          // Você pode sair do time; o capitão pode tirar qualquer um do time dele; o anfitrião move os fictícios.
          const removable = !locked && (p.id === meId || isCaptain || (isHost && p.bot))
          return (
            <PlayerAvatar
              key={`jogador-${p.id}`}
              player={p}
              isMe={p.id === meId}
              captain={i === 0}
              offline={!p.online}
              draggable={removable}
              onClick={() => removable && onRemove(p.id)}
              hint={removable ? (p.id === meId ? "Clique para sair do time" : "Clique para devolver à sala de espera") : undefined}
            />
          )
        })}
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
