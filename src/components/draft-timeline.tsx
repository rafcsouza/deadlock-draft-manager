import { PlayerFace } from "@/components/player-avatar"
import { TeamIcon } from "@/components/team-icon"
import { TEAM_COLORS, TEAM_NAMES, type PlayerView, type Step, type Team } from "@/lib/draft-rules"
import type { Hero } from "@/lib/heroes"

// Linha do tempo do draft, inspirada no histórico de rounds do placar do CS: uma coluna por etapa,
// da esquerda para a direita; o time que age ocupa a sua faixa (Hidden King em cima, Archmother embaixo).
// Mostra o que já aconteceu, a etapa atual (piscando) e as próximas. Sem estado próprio: serve tanto
// para a sala (ao vivo) quanto para o histórico (o draft inteiro, já terminado).

type Kind = "player" | "ban" | "pick"
type State = "done" | "current" | "next" | "skipped"

type Column = {
  team: Team | null // null: ainda não se sabe (antes da moeda)
  kind: Kind
  state: State
  hero?: Hero
  player?: PlayerView
  // Escolhido pelo servidor porque o tempo do turno acabou.
  auto?: boolean
  // Começa um turno novo (outro time ou outra ação): ganha um espaço antes.
  newTurn: boolean
}

const PLAYER_ORDER = [1, 2, 2, 2, 2, 1]
const ACTION_COLOR: Record<Kind, string> = { player: "var(--turn-pick)", ban: "var(--turn-ban)", pick: "var(--turn-pick)" }
const KIND_LABEL: Record<Kind, string> = { player: "escolhe jogador", ban: "bane", pick: "escolhe herói" }

export function DraftTimeline({
  playerSteps,
  playerPicks,
  playersDone,
  currentPlayerPick,
  teams,
  heroSteps,
  actions,
  currentHeroStep,
  heroById,
  teamLabels = TEAM_NAMES,
}: {
  // Ordem da escolha de jogadores (vazia antes da moeda).
  playerSteps: Team[]
  playerPicks: number
  playersDone: boolean
  currentPlayerPick: boolean
  teams: Record<Team, PlayerView[]>
  // Ordem do draft de heróis (com os times reais só depois da escolha de jogadores).
  heroSteps: (Step & { auto?: boolean })[]
  actions: number[]
  currentHeroStep: number | null
  heroById: Map<number, Hero>
  // Nome de cada time na legenda (no histórico: "Time" + nome do capitão).
  teamLabels?: Record<Team, string>
}) {
  const known = playerSteps.length > 0

  // Jogadores: o k-ésimo pick de um time é o (k+1)-ésimo jogador dele (o primeiro é o capitão).
  const seen: Record<Team, number> = { a: 0, b: 0 }
  const playerOrder: (Team | null)[] = known ? playerSteps : PLAYER_ORDER.flatMap((n) => Array<null>(n).fill(null))
  const players: Column[] = playerOrder.map((team, i) => {
    const player = team && i < playerPicks ? teams[team][++seen[team]] : undefined
    const state: State =
      i < playerPicks ? "done" : playersDone ? "skipped" : currentPlayerPick && i === playerPicks ? "current" : "next"
    return { team, kind: "player", state, player, newTurn: i > 0 && turnBreak(playerOrder, i) }
  })

  const heroTeams = heroSteps.map((s) => (known ? s.team : null))
  const heroes: Column[] = heroSteps.map((s, i) => ({
    team: heroTeams[i],
    kind: s.action,
    state: i < actions.length ? "done" : i === currentHeroStep ? "current" : "next",
    hero: i < actions.length ? heroById.get(actions[i]) : undefined,
    auto: s.auto,
    newTurn: i > 0 && (heroTeams[i] !== heroTeams[i - 1] || s.action !== heroSteps[i - 1].action),
  }))

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card/80 px-3 py-2">
      <div className="mx-auto flex w-max items-stretch gap-3">
        <TeamLabels labels={teamLabels} />
        <Section title="Jogadores" columns={players} labels={teamLabels} hint={known ? null : "a moeda define a ordem"} />
        <span className="w-px self-stretch bg-border" />
        <Section title="Heróis" columns={heroes} labels={teamLabels} hint={known ? null : "começa quem não escolheu jogador primeiro"} />
      </div>
    </div>
  )
}

function turnBreak(order: (Team | null)[], i: number) {
  // Antes da moeda os times são desconhecidos: separa pelos tamanhos dos turnos (1-2-2-2-2-1).
  if (order[i] === null) {
    let end = 0
    for (const n of PLAYER_ORDER) {
      if (i === end) return true
      end += n
    }
    return false
  }
  return order[i] !== order[i - 1]
}

function TeamLabels({ labels }: { labels: Record<Team, string> }) {
  return (
    <div className="flex max-w-32 flex-col justify-between pb-0.5 pt-4 text-right text-[9px] font-black uppercase leading-none tracking-wider">
      <span className="flex items-center justify-end gap-1 truncate" style={{ color: TEAM_COLORS.a }}>
        <TeamIcon team="a" className="h-3 w-3" />
        {labels.a}
      </span>
      <span className="flex items-center justify-end gap-1 truncate" style={{ color: TEAM_COLORS.b }}>
        <TeamIcon team="b" className="h-3 w-3" />
        {labels.b}
      </span>
    </div>
  )
}

function Section({ title, columns, labels, hint }: { title: string; columns: Column[]; labels: Record<Team, string>; hint: string | null }) {
  return (
    <div>
      <p className="mb-1 flex items-baseline gap-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
        {hint && <span className="font-normal normal-case tracking-normal opacity-70">({hint})</span>}
      </p>
      {/* Linha do meio, como a divisória do placar do CS. */}
      <div className="relative flex">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {columns.map((c, i) => (
          <div key={i} className={`relative flex flex-col gap-2 ${c.newTurn ? "ml-2" : i > 0 ? "ml-0.5" : ""}`}>
            <Slot column={c} row="a" n={i + 1} labels={labels} />
            <Slot column={c} row="b" n={i + 1} labels={labels} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Slot({ column: c, row, n, labels }: { column: Column; row: Team; n: number; labels: Record<Team, string> }) {
  // Antes da moeda a etapa fica no meio, sem time; depois, só na faixa do time que age.
  if (c.team === null) {
    return row === "a" ? (
      <span className="h-6 w-6 translate-y-4 rounded-md border border-dashed border-muted-foreground/30 bg-card" title={`${n}º`} />
    ) : (
      <span className="h-6 w-6" />
    )
  }
  if (c.team !== row) return <span className="h-6 w-6" />

  const teamColor = TEAM_COLORS[c.team]
  const title = `${n}º · ${labels[c.team]} ${KIND_LABEL[c.kind]}${c.hero ? `: ${c.hero.name}` : c.player ? `: ${c.player.name}` : ""}${
    c.auto ? " (tempo esgotado: escolha aleatória)" : ""
  }`

  if (c.state === "done") {
    return (
      <span
        title={title}
        className="relative h-6 w-6 overflow-hidden rounded-md border-b-2 bg-muted"
        style={{ borderColor: c.kind === "ban" ? "var(--turn-ban)" : teamColor }}
      >
        {c.hero ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.kind === "ban" ? c.hero.critical : c.hero.card}
              alt=""
              className={`h-full w-full hero-face ${c.kind === "ban" ? "opacity-60 grayscale" : ""}`}
            />
            {c.kind === "ban" && <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-red-500">✕</span>}
            {c.auto && <span className="absolute right-0 top-0 rounded-bl bg-black/80 px-0.5 text-[7px] leading-tight text-yellow-300">⏱</span>}
          </>
        ) : c.player ? (
          <PlayerFace player={c.player} className="h-full w-full rounded-none text-[8px]" />
        ) : null}
      </span>
    )
  }

  if (c.state === "skipped") {
    return (
      <span title={`${n}º · pulado`} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40">
        –
      </span>
    )
  }

  const current = c.state === "current"
  return (
    <span
      title={current ? `Agora: ${title}` : title}
      className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${current ? "timeline-now" : "border-dashed opacity-50"}`}
      style={
        current
          ? ({ "--turn-color": ACTION_COLOR[c.kind], borderColor: ACTION_COLOR[c.kind], color: ACTION_COLOR[c.kind] } as React.CSSProperties)
          : { borderColor: teamColor, color: teamColor }
      }
    >
      <KindIcon kind={c.kind} className="h-3.5 w-3.5" />
    </span>
  )
}

// Ícone da ação: círculo cortado (ban), check (pick de herói) ou pessoa (escolha de jogador).
export function KindIcon({ kind, className, style }: { kind: Kind; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "ban" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m5.6 5.6 12.8 12.8" />
        </>
      ) : kind === "pick" ? (
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      ) : (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </>
      )}
    </svg>
  )
}
