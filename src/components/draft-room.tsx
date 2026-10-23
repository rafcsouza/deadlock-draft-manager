"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { CoinFlip } from "@/components/coin-flip"
import { DraftTimeline, KindIcon } from "@/components/draft-timeline"
import { MatchResultPanel } from "@/components/match-result"
import { EmptySlot, HostBadge, PlayerAvatar, PlayerRow } from "@/components/player-avatar"
import { RoomChat } from "@/components/room-chat"
import { RoomClosed } from "@/components/room-closed"
import { SoundMenu } from "@/components/sound-toggle"
import { TeamIcon } from "@/components/team-icon"
import {
  buildPlayerSteps,
  buildSteps,
  COIN_TOTAL_MS,
  slotsFor,
  TEAM_COLORS,
  TEAM_NAMES,
  TEAM_SIZE,
  ORDER_LABELS,
  TOTAL_STEPS,
  TURN_MAX,
  TURN_MIN,
  TURN_STEP,
  type PlayerView,
  type RoomView,
  type Step,
  type Team,
  type DraftOrder,
} from "@/lib/draft-rules"
import { formatDuration } from "@/lib/format"
import type { Hero } from "@/lib/heroes"
import { useFitGrid } from "@/lib/use-fit-grid"
import { playSound, playVoice } from "@/lib/sound"
import { useRoom, useServerClock } from "@/lib/use-room"
import { useRoomSounds, type PlayedEarly } from "@/lib/use-room-sounds"

const TEAMS: Record<Team, { name: string; color: string }> = {
  a: { name: TEAM_NAMES.a, color: TEAM_COLORS.a },
  b: { name: TEAM_NAMES.b, color: TEAM_COLORS.b },
}

const HERO_GAP = 6

// Sala de draft: 1) sala de espera + chat, 2) heróis, 3) times (o primeiro
// jogador de cada time é o capitão), 4) bans de cada time, 5) de quem é a vez.
// O estado vem do servidor em tempo real; aqui só mostramos e enviamos ações.
export function DraftRoom({ code, heroes, meId }: { code: string; heroes: Hero[]; meId: string }) {
  const room = useRoom(code)
  if (room.closed) return <RoomClosed />
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
  // Herói marcado no primeiro clique; o segundo clique no mesmo card confirma o ban/pick.
  const [pending, setPending] = useState<number | null>(null)
  // Sons que esta tela já tocou no clique (fala do herói marcado, vinheta de início), para não repetir.
  const playedEarly = useRef<PlayedEarly>({ hero: null, start: false })
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
  const steps = buildSteps(view.first, view.order)
  const hasCaptains = teams.a.length > 0 && teams.b.length > 0
  // Fases: capitães → (moeda) → escolha de jogadores → draft de heróis.
  const started = view.playerFirst !== null
  const heroPhase = Boolean(view.first)
  const finished = actions.length === TOTAL_STEPS
  const coinPhase = view.coinAt !== null && now < view.coinAt + COIN_TOTAL_MS
  const playerSteps = view.playerFirst ? buildPlayerSteps(view.playerFirst) : []
  const pickTeam = started && !view.playersDone && !coinPhase ? (playerSteps[view.playerPicks] ?? null) : null
  const current = heroPhase && !finished && !coinPhase ? steps[actions.length] : null
  const remaining = view.deadline ? Math.ceil((view.deadline - now) / 1000) : 0

  const myTeam = (["a", "b"] as const).find((t) => teams[t].some((p) => p.id === meId)) ?? null
  const captainTeam = (["a", "b"] as const).find((t) => teams[t][0]?.id === meId) ?? null
  const isHost = view.hostId === meId
  // Quem joga pelo time: o capitão, ou o anfitrião quando o capitão é um jogador fictício.
  const actsFor = (team: Team) => {
    const captain = teams[team][0]
    return Boolean(captain && (captain.id === meId || (isHost && captain.bot)))
  }
  // Sua vez no draft de heróis: vermelho para banir, verde para escolher.
  const myAction = current && actsFor(current.team) ? current.action : null
  const turnColor = myAction === "ban" ? "var(--turn-ban)" : "var(--turn-pick)"
  const selectedIsBot = view.lobby.some((p) => p.id === selected && p.bot)
  const canManage = isHost || captainTeam !== null
  const canPickPlayer = pickTeam !== null && actsFor(pickTeam)
  useRoomSounds({
    view,
    meId,
    myTurn: (current !== null && actsFor(current.team)) || canPickPlayer,
    secondsLeft: current ? Math.max(remaining, 0) : null,
    error,
    now,
    voicesOf: (heroId) => heroById.get(heroId)?.voices ?? { pick: [], ban: [] },
    playedEarly,
  })
  const pickPlayer = (playerId: string | null | undefined) => {
    if (playerId && canPickPlayer) send({ type: "pickPlayer", playerId })
  }
  // Último jogador escolhido: o capitão daquele time pode desfazer (até o primeiro herói).
  const lastPickTeam = (["a", "b"] as const).find((t) => teams[t].some((p) => p.id === view.lastPick)) ?? null
  const undoable = lastPickTeam && actsFor(lastPickTeam) ? view.lastPick : null

  const heroesOf = (team: Team, action: Step["action"]) =>
    actions
      .filter((_, i) => steps[i].team === team && steps[i].action === action)
      .map((id) => heroById.get(id))
      .filter((h): h is Hero => Boolean(h))
  const statusOf = (hero: Hero) => {
    const i = actions.indexOf(hero.id)
    return i === -1 ? null : steps[i]
  }

  // Avisa na aba do navegador quando é a sua vez (útil com a sala em segundo plano).
  useEffect(() => {
    if (!myAction) return
    const original = document.title
    document.title = myAction === "ban" ? "🔴 Sua vez de banir" : "🟢 Sua vez de escolher"
    return () => {
      document.title = original
    }
  }, [myAction, actions.length])

  // A marcação some quando o turno muda; Esc também cancela.
  useEffect(() => setPending(null), [myAction, actions.length])
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPending(null)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pending])

  const move = (playerId: string | null | undefined, to: Team | "lobby") => {
    setSelected(null)
    if (playerId && !started) send({ type: "move", playerId, to })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 lg:h-screen lg:flex-row lg:p-6">
      {/* 1. Sala de espera (metade de cima) e chat (metade de baixo) */}
      <aside className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 lg:w-64 lg:shrink-0">
        <div className="flex items-center gap-1 border-b border-border p-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Voltar
          </Link>
          <HelpButton order={view.order} />
          <SoundMenu align="left" />
        </div>
        <div className="space-y-2.5 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider">Sala de espera</h2>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{view.lobby.length}</span>
          </div>
          <CopyLinkButton />
        </div>
        {/* Ordem de bans e picks da sala, escolhida na criação. */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground" title={ORDER_LABELS[view.order].hint}>
          <KindIcon kind="pick" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">
            Ordem dos picks: <span className="font-semibold text-foreground">{ORDER_LABELS[view.order].name}</span>
          </span>
          <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{ORDER_LABELS[view.order].pattern}</span>
        </div>
        {view.host && (
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <HostBadge className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">
              {view.host.id === meId ? (
                <span className="font-semibold text-foreground">Sua sala</span>
              ) : (
                <>
                  Sala de <span className="font-semibold text-foreground">{view.host.name}</span>
                </>
              )}
              {view.host.guest && " (visitante)"}
              {!view.host.online && " · offline"}
            </span>
            {/* Cadeado aberto: aparece na página inicial. Fechado: só com o link. Só o dono troca e exclui a sala. */}
            {isHost ? (
              <span className="ml-auto flex shrink-0 items-center gap-0.5">
                <button
                  onClick={() => send({ type: "setOpen", open: !view.open })}
                  title={view.open ? "Sala aberta (aparece na página inicial). Clique para trancar: só com o link." : "Sala trancada (só com o link). Clique para abrir na página inicial."}
                  aria-label={view.open ? "Trancar a sala" : "Abrir a sala na página inicial"}
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted ${view.open ? "text-green-300" : "text-yellow-300"}`}
                >
                  <LockIcon locked={!view.open} />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Excluir a sala? Todo mundo nela será desconectado e o link para de funcionar.")) send({ type: "closeRoom" })
                  }}
                  title="Excluir a sala"
                  aria-label="Excluir a sala"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-600/15 hover:text-red-300"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
              </span>
            ) : (
              <span className={`ml-auto shrink-0 ${view.open ? "text-green-300" : "text-yellow-300"}`} title={view.open ? "Sala aberta" : "Sala trancada (só com o link)"}>
                <LockIcon locked={!view.open} />
              </span>
            )}
          </div>
        )}

        <div
          onDragOver={(e) => !started && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            move(e.dataTransfer.getData("text/plain"), "lobby")
          }}
          className="flex min-h-40 flex-col lg:min-h-0 lg:flex-1 lg:basis-0"
        >
          <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {view.lobby.map((p) => {
              // Antes do draft: você se move (ou o anfitrião move um fictício) para a vaga de capitão.
              // Na escolha de jogadores: o capitão da vez clica (ou arrasta) para escolher.
              const movable = !started && (p.id === meId || (isHost && p.bot))
              return (
                <PlayerRow
                  key={p.id}
                  player={p}
                  isMe={p.id === meId}
                  host={p.id === view.hostId}
                  selected={selected === p.id}
                  draggable={movable || canPickPlayer}
                  onClick={
                    canPickPlayer
                      ? () => pickPlayer(p.id)
                      : movable
                        ? () => setSelected(selected === p.id ? null : p.id)
                        : undefined
                  }
                  action={canPickPlayer ? "Escolher" : undefined}
                  onRemove={isHost && p.bot ? () => send({ type: "removeBot", playerId: p.id }) : undefined}
                />
              )
            })}
            {/* Jogadores fictícios para testes (só o anfitrião adiciona). */}
            {isHost && !view.playersDone && <AddBot onAdd={(name) => send({ type: "addBot", name })} />}
            {view.lobby.length === 0 && !isHost && (
              <p className="w-full pt-4 text-center text-xs text-muted-foreground">Ninguém aguardando.</p>
            )}
          </div>
        </div>

        <div className="flex h-80 flex-col border-t border-border lg:h-auto lg:min-h-0 lg:flex-1 lg:basis-0">
          <RoomChat
            code={view.code}
            messages={view.chat}
            meId={meId}
            myTeam={myTeam}
            onSend={(channel, text, image) => send({ type: "chat", channel, text, image })}
          />
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {(["a", "b"] as const).map((team) => (
            <div key={team}>
              {/* 3. Time, com o capitão no primeiro quadrado (e os bans do time à direita) */}
              <TeamCard
                team={team}
                players={teams[team]}
                meId={meId}
                isHost={isHost}
                hostId={view.hostId}
                picks={heroesOf(team, "pick")}
                bans={heroesOf(team, "ban")}
                active={current?.team === team || pickTeam === team}
                locked={started}
                canAssign={selected !== null && teams[team].length === 0 && (selected === meId || (isHost && selectedIsBot))}
                onAdd={(playerId) => (canPickPlayer ? pickPlayer(playerId) : move(playerId ?? selected, team))}
                onRemove={(playerId) => move(playerId, "lobby")}
                undoable={lastPickTeam === team ? undoable : null}
                onUndo={() => send({ type: "undoPick" })}
              />
            </div>
          ))}
        </div>

        {/* Linha do tempo: ordem de todas as escolhas, do início ao fim. */}
        <DraftTimeline
          playerSteps={playerSteps}
          playerPicks={view.playerPicks}
          playersDone={view.playersDone}
          currentPlayerPick={pickTeam !== null}
          teams={teams}
          // Antes de o servidor liberar os heróis, já se sabe quem começa: o time que não escolheu jogador primeiro.
          heroSteps={buildSteps(view.first ?? (view.playerFirst === "a" ? "b" : view.playerFirst === "b" ? "a" : null), view.order)}
          actions={actions}
          currentHeroStep={current ? actions.length : null}
          heroById={heroById}
        />

        {/* 2. Heróis */}
        <section
          className={`relative flex h-[75svh] min-h-0 flex-col rounded-2xl border bg-card/80 lg:h-auto lg:flex-1 ${
            myAction ? "turn-glow" : "border-border"
          }`}
          style={{ "--turn-color": turnColor } as React.CSSProperties}
        >
          {/* 5. De quem é a vez */}
          <div className="relative flex h-16 shrink-0 items-center justify-center border-b border-border pl-3 pr-24 sm:px-44">
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
            {!started ? (
              <CaptainsBanner
                hasCaptains={hasCaptains}
                canRandomize={isHost}
                canStart={hasCaptains && canManage}
                onRandomize={() => send({ type: "randomizeCaptains" })}
                onStart={() => {
                  // A vinheta de início sai no clique, sem esperar o servidor confirmar.
                  playSound("draftStart")
                  playedEarly.current.start = true
                  // Se o servidor recusar (ex.: falta capitão), a vinheta volta a tocar no próximo início.
                  window.setTimeout(() => (playedEarly.current.start = false), 5000)
                  send({ type: "startDraft" })
                }}
              />
            ) : coinPhase ? (
              <CoinFlip
                sides={{ a: { ...TEAMS.a, letter: "H" }, b: { ...TEAMS.b, letter: "A" } }}
                result={view.playerFirst}
                coinAt={view.coinAt}
                now={now}
                canFlip={false}
                onFlip={() => {}}
                resultText="escolhe jogador primeiro"
              />
            ) : !view.playersDone ? (
              <PlayersBanner
                steps={playerSteps}
                picks={view.playerPicks}
                myTurn={canPickPlayer}
                canEnd={canManage}
                onEnd={() => send({ type: "endPlayerPicks" })}
              />
            ) : (
              <TurnBanner
                steps={steps}
                current={current}
                finished={finished}
                actions={actions.length}
                remaining={remaining}
                myTurn={myAction !== null}
                canRestart={canManage}
                onRestart={() => send({ type: "restart" })}
              />
            )}
            {current && view.deadline && (
              <TimeBar left={view.deadline - now} total={view.turnSeconds * 1000} color={current.action === "ban" ? "var(--turn-ban)" : "var(--turn-pick)"} />
            )}
          </div>
          {/* Os cards são dimensionados para todos caberem na área, sem rolagem. */}
          <div
            ref={heroArea}
            // Clicar fora dos cards cancela a marcação.
            onClick={(e) => !(e.target as HTMLElement).closest("button") && setPending(null)}
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3"
          >
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
                const marked = clickable && pending === h.id
                return (
                  <button
                    key={h.id}
                    onClick={() => {
                      if (!clickable) return
                      // 1º clique marca; 2º clique no mesmo card confirma.
                      if (marked) {
                        setPending(null)
                        send({ type: "choose", heroId: h.id })
                      } else {
                        setPending(h.id)
                        playSound("mark")
                        // A fala do herói já sai no 1º clique (ban: desdém; pick: positiva), não só ao confirmar.
                        void playVoice(myAction === "ban" ? h.voices.ban : h.voices.pick, { kind: myAction ?? "pick" })
                        playedEarly.current.hero = h.id
                      }
                    }}
                    // Passar o mouse num herói disponível dá o "clique" tátil (fora da vez também).
                    onMouseEnter={() => !status && playSound("hover")}
                    // Sem disabled: botão desativado não dispara o hover. O clique já é barrado acima.
                    aria-disabled={!clickable}
                    data-sound="none"
                    title={marked ? `Clique de novo para confirmar: ${h.name}` : h.name}
                    // Disponível: sem cor; ao passar o mouse, cresce em relevo e ganha a cor do herói.
                    // Na sua vez, a borda do hover ganha a cor da ação (vermelho banir, verde escolher).
                    className={`group relative aspect-[3/4] overflow-hidden rounded-lg border-b-2 bg-muted transition-[transform,box-shadow,border-color] duration-200 ${
                      status
                        ? ""
                        : marked
                          ? "z-10 scale-110 border-[var(--turn-color)] shadow-xl shadow-black/70"
                          : clickable
                            ? "border-border hover:z-10 hover:scale-110 hover:border-[var(--turn-color)] hover:shadow-xl hover:shadow-black/70 hover:outline-2 hover:outline-[var(--turn-color)]"
                            : "border-border hover:z-10 hover:scale-110 hover:border-[var(--hero-color)] hover:shadow-xl hover:shadow-black/70"
                    } ${clickable ? "cursor-pointer" : "cursor-default"}`}
                    style={
                      {
                        "--hero-color": h.color,
                        borderColor: status ? h.color : undefined,
                        outline:
                          status?.action === "pick"
                            ? `2px solid ${TEAMS[status.team].color}`
                            : marked
                              ? `3px solid ${turnColor}`
                              : undefined,
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
                        status?.action === "ban" ? "opacity-60" : status || marked ? "" : "grayscale group-hover:grayscale-0"
                      }`}
                    />
                    {/* Em cards muito pequenos o nome não caberia; fica no tooltip. */}
                    {heroGrid && heroGrid.width >= 52 && (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1 pb-1 pt-4 text-center text-[10px] font-bold leading-tight text-white">
                        {h.name}
                      </span>
                    )}
                    {marked && myAction && (
                      // Marcado: pede a confirmação em cima do próprio card.
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30">
                        <span
                          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-black tracking-widest text-white shadow-lg shadow-black/60"
                          style={{ background: turnColor }}
                        >
                          <KindIcon kind={myAction} className="h-2.5 w-2.5" />
                          {myAction === "ban" ? "BAN?" : "PICK?"}
                        </span>
                        {heroGrid && heroGrid.width >= 52 && (
                          <span className="px-1 text-center text-[9px] font-semibold leading-tight text-white drop-shadow">
                            clique para confirmar
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Cancelar"
                          title="Cancelar"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPending(null)
                          }}
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] leading-none text-white hover:bg-black"
                        >
                          ✕
                        </span>
                      </span>
                    )}
                    {clickable && !marked && myAction && (
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <span
                          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black tracking-widest text-white shadow-lg shadow-black/60"
                          style={{ background: turnColor }}
                        >
                          <KindIcon kind={myAction} className="h-2.5 w-2.5" />
                          {myAction === "ban" ? "BANIR" : "ESCOLHER"}
                        </span>
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

function CaptainsBanner({
  hasCaptains,
  canRandomize,
  canStart,
  onRandomize,
  onStart,
}: {
  hasCaptains: boolean
  canRandomize: boolean
  canStart: boolean
  onRandomize: () => void
  onStart: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {!hasCaptains && <span className="text-sm text-muted-foreground">Escolham os dois capitães</span>}
      {canRandomize && (
        <button
          onClick={onRandomize}
          className="rounded-full border border-border bg-muted px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-colors hover:border-muted-foreground"
        >
          Randomizar capitães
        </button>
      )}
      {canStart && (
        <button
          onClick={onStart}
          className="rounded-full px-5 py-1.5 font-display text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-black/40 bg-team-gradient"
        >
          Iniciar draft
        </button>
      )}
      {hasCaptains && !canStart && <span className="text-sm text-muted-foreground">Aguardando um capitão iniciar o draft</span>}
    </div>
  )
}

function PlayersBanner({
  steps,
  picks,
  myTurn,
  canEnd,
  onEnd,
}: {
  steps: Team[]
  picks: number
  myTurn: boolean
  canEnd: boolean
  onEnd: () => void
}) {
  const team = steps[picks]
  if (!team) return null
  // Quantos jogadores seguidos o time ainda escolhe neste turno.
  let count = 0
  while (steps[picks + count] === team) count++
  const { name, color } = TEAMS[team]
  const verb = `escolhe ${count === 1 ? "um jogador" : `${count} jogadores`}`
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <span
        className="rounded-full border px-5 py-1.5 font-display text-lg font-bold uppercase tracking-wider"
        style={{ borderColor: color, color }}
      >
        {myTurn ? "Sua vez: " : `${name} `}
        <span className="text-foreground">{verb}</span>
      </span>
      {canEnd && (
        <button
          onClick={onEnd}
          title="Fecha os times como estão e vai para os heróis"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Encerrar escolha
        </button>
      )}
    </div>
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
  // Entre a moeda e o primeiro turno não há turno atual (a moeda aparece no lugar).
  if (!current) return null

  // Quantas ações seguidas iguais o time ainda tem neste turno (ex.: 2 picks).
  let count = 0
  while (steps[actions + count]?.team === current.team && steps[actions + count]?.action === current.action) {
    count++
  }
  const { name, color } = TEAMS[current.team]
  const verb =
    current.action === "ban" ? "bane um herói" : `escolhe ${count === 1 ? "um herói" : `${count} heróis`}`

  const seconds = Math.max(remaining, 0)
  const turnColor = current.action === "ban" ? "var(--turn-ban)" : "var(--turn-pick)"
  return (
    <div className="flex items-center gap-3">
      {myTurn ? (
        // Sua vez: faixa cheia na cor da ação, com ícone, para não passar despercebido.
        <span
          className="flex animate-pulse items-center gap-2 rounded-full px-5 py-1.5 font-display text-lg font-bold uppercase tracking-wider text-white shadow-lg shadow-black/50 [animation-duration:1.6s]"
          style={{ background: turnColor }}
        >
          <KindIcon kind={current.action} className="h-5 w-5" />
          {current.action === "ban"
            ? "Sua vez de banir"
            : `Sua vez de escolher${count > 1 ? ` ${count} heróis` : ""}`}
        </span>
      ) : (
        <span
          className="flex items-center gap-2 rounded-full border px-5 py-1.5 font-display text-lg font-bold uppercase tracking-wider"
          style={{ borderColor: color, color }}
        >
          <TeamIcon team={current.team} className="h-5 w-5" />
          {name} <span className="text-foreground">{verb}</span>
          <KindIcon kind={current.action} className="h-4 w-4" style={{ color: turnColor }} />
        </span>
      )}
      <span
        className={`w-14 rounded-full border px-2 py-1.5 text-center font-mono text-sm font-bold tabular-nums ${
          seconds <= 10 ? "border-red-600/70 text-red-400" : "border-border text-muted-foreground"
        }`}
        aria-label={`${seconds} segundos restantes`}
      >
        {formatDuration(seconds)}
      </span>
    </div>
  )
}

// Barra na borda de baixo da faixa da vez: esvazia conforme o tempo do turno acaba e fica vermelha
// nos últimos 10 segundos.
function TimeBar({ left, total, color }: { left: number; total: number; color: string }) {
  const fraction = Math.min(1, Math.max(0, left / Math.max(total, 1)))
  const urgent = left <= 10_000
  return (
    <div className="absolute inset-x-0 -bottom-px h-1.5 overflow-hidden bg-muted/40" role="progressbar" aria-label="Tempo do turno" aria-valuenow={Math.round(fraction * 100)}>
      <div
        className={`h-full transition-[width,background-color] duration-300 ease-linear ${urgent ? "animate-pulse" : ""}`}
        style={{ width: `${fraction * 100}%`, background: urgent ? "#ef4444" : color, boxShadow: `0 0 10px ${urgent ? "#ef4444" : color}` }}
      />
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
        aria-label={`Tempo por turno: ${value} segundos${locked ? "" : " (clique para mudar)"}`}
        title={locked ? "Tempo por turno" : "Mudar o tempo por turno"}
        aria-expanded={open}
        className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors hover:bg-muted hover:text-foreground ${
          open ? "border-foreground/40 bg-muted text-foreground" : "border-border text-muted-foreground"
        }`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5M9 2h6" />
        </svg>
        <span className="font-mono tabular-nums">{value}s</span>
        <span className="hidden sm:inline">por turno</span>
        {!locked && (
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
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

// Vaga de ban no card do time: retrato de vida baixa do herói banido, ou vazia com o ícone de ban.
function BanSlot({ hero }: { hero?: Hero }) {
  if (!hero) {
    return (
      <span className="flex h-14 w-11 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground/40">
        <KindIcon kind="ban" className="h-5 w-5" />
      </span>
    )
  }
  return (
    <span className="relative h-14 w-11 overflow-hidden rounded-lg border border-red-600/70" title={`${hero.name} (banido)`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={portrait(hero, "ban")} alt={hero.name} className="hero-face h-full w-full grayscale-[40%]" />
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-0.5 pb-0.5 pt-3 text-center text-[9px] font-bold text-white">
        {hero.name}
      </span>
    </span>
  )
}

// Retrato conforme o estado: vida baixa quando banido, "on fire" quando escolhido.
function portrait(hero: Hero, action?: Step["action"]) {
  if (action === "ban") return hero.critical
  if (action === "pick") return hero.gloat
  return hero.card
}

// Pick do time (card padrão do herói).
function HeroIcon({ hero }: { hero?: Hero }) {
  if (!hero) {
    return <span className="h-9 w-9 rounded-md border border-dashed border-border bg-muted/40" />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={hero.card} alt={hero.name} title={hero.name} className="h-9 w-9 rounded-md hero-face" />
  )
}

function TeamCard({
  team,
  players,
  meId,
  isHost,
  hostId,
  picks,
  bans,
  active,
  locked,
  canAssign,
  onAdd,
  onRemove,
  undoable,
  onUndo,
}: {
  team: Team
  players: PlayerView[]
  meId: string
  isHost: boolean
  hostId: string | null
  picks: Hero[]
  bans: Hero[]
  active: boolean
  locked: boolean
  canAssign: boolean
  onAdd: (playerId?: string) => void
  onRemove: (playerId: string) => void
  // Jogador que você escolheu por último e ainda pode devolver à sala de espera.
  undoable: string | null
  onUndo: () => void
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
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color }}>
          <TeamIcon team={team} className="h-5 w-5" />
          {name}
        </p>
        <span className="text-[11px] text-muted-foreground">
          {players.length}/{TEAM_SIZE}
        </span>
      </div>
      <div className="flex gap-4">
      <div className="min-w-0 flex-1">
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: TEAM_SIZE }, (_, i) => {
          const p = players[i]
          if (!p) {
            return (
              <EmptySlot
                // Prefixos evitam colisão entre a posição do quadrado vazio e o ID de um jogador (ex.: "1").
                key={`vazio-${i}`}
                captain={i === 0}
                // Antes do draft, só a vaga de capitão (vazia) recebe o "+"; os demais entram pela escolha dos capitães.
                onJoin={!locked && i === 0 && players.length === 0 ? () => onAdd(meId) : undefined}
              />
            )
          }
          // Antes do draft: você pode sair da vaga de capitão; o anfitrião também tira os fictícios.
          const removable = !locked && (p.id === meId || (isHost && p.bot))
          const undo = p.id === undoable
          return (
            <PlayerAvatar
              key={`jogador-${p.id}`}
              player={p}
              isMe={p.id === meId}
              captain={i === 0}
              host={p.id === hostId}
              offline={!p.online}
              draggable={removable}
              onClick={() => (undo ? onUndo() : removable && onRemove(p.id))}
              hint={
                undo
                  ? "Clique para desfazer a escolha"
                  : removable
                    ? p.id === meId
                      ? "Clique para sair do time"
                      : "Clique para devolver à sala de espera"
                    : undefined
              }
            />
          )
        })}
      </div>
      {undoable && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onUndo()
          }}
          className="mt-2 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ↶ Desfazer escolha de {players.find((p) => p.id === undoable)?.name}
        </button>
      )}
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
      {/* 4. Bans do time, no espaço livre à direita do card */}
      <div className="mt-2 flex shrink-0 flex-col items-center justify-center gap-2 border-l border-border pl-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bans</span>
        <div className="flex gap-2">
          {Array.from({ length: slotsFor(team, "ban") }, (_, i) => (
            <BanSlot key={i} hero={bans[i]} />
          ))}
        </div>
      </div>
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
      className="bg-team-gradient flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-white shadow-lg shadow-black/40 transition-transform hover:-translate-y-0.5"
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
      {copied ? "Link copiado!" : "Copiar link da sala"}
    </button>
  )
}

// "Como usar": guia rápido da sala, aberto pelo botão no topo da sala de espera.
function HelpButton({ order }: { order: DraftOrder }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current text-[11px] font-black">?</span>
        Ajuda
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 text-sm shadow-2xl shadow-black/60"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ✕
            </button>
            <h2 id="help-title" className="font-display text-xl font-bold uppercase tracking-wide">
              Como funciona o draft
            </h2>
            <ol className="mt-4 space-y-3">
              <HelpStep n={1} title="Capitães">
                Cada time precisa de um capitão. Clique no <b>+</b> da vaga com a coroa para ser o capitão daquele time. O dono da
                sala (★) também pode <b>randomizar</b> os capitães.
              </HelpStep>
              <HelpStep n={2} title="Iniciar">
                Com os dois capitães, um deles (ou o dono da sala) clica em <b>Iniciar draft</b>. A moeda decide qual time escolhe
                jogador primeiro.
              </HelpStep>
              <HelpStep n={3} title="Escolher jogadores">
                Na sua vez, clique em <b>Escolher</b> ao lado de um jogador da sala de espera. A ordem é 1-2-2-2-2-1. Escolheu errado?
                Clique em <b>↶ Desfazer escolha</b> no card do seu time (vale para a última escolha, antes do primeiro herói).
              </HelpStep>
              <HelpStep n={4} title="Heróis">
                Começa o time que <b>não</b> escolheu jogador primeiro. Esta sala usa a ordem{" "}
                <b>{ORDER_LABELS[order].name.toLowerCase()}</b> ({ORDER_LABELS[order].hint.charAt(0).toLowerCase() + ORDER_LABELS[order].hint.slice(1)}); a
                linha do tempo acima dos heróis mostra a sequência inteira. Na sua vez, a área de heróis fica <b className="text-red-400">vermelha</b>{" "}
                para banir ou <b className="text-green-400">verde</b> para escolher: clique no herói e clique de novo para confirmar. Se o
                tempo acabar, sai um herói aleatório.
              </HelpStep>
              <HelpStep n={5} title="Depois da partida">
                Informe o <b>ID da partida</b> (aparece no fim do jogo) para buscar os stats e salvar no histórico e no leaderboard.
              </HelpStep>
            </ol>
            <h3 className="mt-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Dicas</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Use <b className="text-foreground">Copiar link da sala</b> para chamar o pessoal.</li>
              <li>O botão ⏱ ao lado da vez muda o tempo de cada turno (antes da primeira escolha de herói).</li>
              <li>O chat mostra as mensagens gerais e as do seu time juntas (as do time com a etiqueta TIME). Dá para mandar imagens e GIFs; nada fica salvo depois que a sala fecha.</li>
              <li>O dono da sala pode adicionar jogadores fictícios para testar.</li>
              <li>
                O alto-falante no topo abre os ajustes de som: ligar e desligar, volume, falas dos heróis e o som de cada momento.
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

function HelpStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="bg-team-gradient flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">{n}</span>
      <p className="leading-snug text-muted-foreground">
        <b className="text-foreground">{title}.</b> {children}
      </p>
    </li>
  )
}

// Anfitrião adiciona um jogador fictício, com nome opcional (ex.: alguém que não conseguiu entrar na sala).
function AddBot({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full items-center gap-2.5 rounded-lg border border-dashed border-border px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        <span className="flex h-8 w-8 items-center justify-center text-lg">+</span>
        Adicionar jogador fictício
      </button>
    )
  }

  const close = () => {
    setOpen(false)
    setName("")
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onAdd(name.trim())
        close()
      }}
      className="mt-1 space-y-1.5 rounded-lg border border-dashed border-muted-foreground/50 p-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && close()}
        maxLength={20}
        autoFocus
        placeholder="Nome (opcional)"
        aria-label="Nome do jogador fictício"
        className="w-full rounded-md border border-border bg-muted/60 px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-muted-foreground/60"
      />
      <div className="flex gap-1.5">
        <button type="submit" className="bg-team-gradient flex-1 rounded-md py-1.5 text-xs font-bold text-white">
          Adicionar
        </button>
        <button type="button" onClick={close} className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// Cadeado: fechado = sala só com o link; aberto = aparece na página inicial.
function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d={locked ? "M8 11V7a4 4 0 0 1 8 0v4" : "M8 11V7a4 4 0 0 1 7.5-2"} />
    </svg>
  )
}
