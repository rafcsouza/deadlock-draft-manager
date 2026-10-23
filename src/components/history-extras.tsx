import Link from "next/link"
import { TeamIcon } from "@/components/team-icon"
import { TEAM_COLORS, TEAM_NAMES, type Team } from "@/lib/draft-rules"
import type { SavedDraft } from "@/lib/drafts"
import { formatDuration } from "@/lib/format"
import type { Hero } from "@/lib/heroes"

// Extras do histórico: resumo geral, filtros e agrupamento por dia.

export type HistoryFilter = "todas" | "minhas" | "pendentes"

type HeroCount = { hero: Hero; count: number; wins: number }

// Resumo das partidas confirmadas: placar entre os lados, duração e heróis mais escolhidos/banidos.
export function HistorySummary({ drafts, heroes }: { drafts: SavedDraft[]; heroes: Map<number, Hero> }) {
  const matches = drafts.filter((d) => d.verified)
  if (matches.length === 0) return null

  const wins = { a: matches.filter((d) => d.winner === "a").length, b: matches.filter((d) => d.winner === "b").length }
  const average = Math.round(matches.reduce((sum, d) => sum + d.durationS, 0) / matches.length)
  const longest = Math.max(...matches.map((d) => d.durationS))

  const picks = new Map<number, HeroCount>()
  const bans = new Map<number, HeroCount>()
  const add = (map: Map<number, HeroCount>, heroId: number, won: boolean) => {
    const hero = heroes.get(heroId)
    if (!hero) return
    const entry = map.get(heroId) ?? { hero, count: 0, wins: 0 }
    entry.count++
    if (won) entry.wins++
    map.set(heroId, entry)
  }
  for (const d of matches) {
    for (const p of d.stats) add(picks, p.heroId, p.team === d.winner)
    for (const s of d.steps) if (s.action === "ban") add(bans, s.heroId, false)
  }
  const top = (map: Map<number, HeroCount>) => [...map.values()].sort((a, b) => b.count - a.count || b.wins - a.wins).slice(0, 5)

  return (
    <section className={`mb-4 grid gap-3 ${bans.size ? "lg:grid-cols-[1.2fr_1fr_1fr]" : "lg:grid-cols-[1.2fr_1fr]"}`}>
      <div className="rounded-2xl border border-border bg-card/80 p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Placar dos lados</p>
        <div className="flex items-center justify-between font-display text-lg font-bold uppercase">
          <SideScore team="a" wins={wins.a} />
          <span className="text-sm text-muted-foreground">×</span>
          <SideScore team="b" wins={wins.b} reverse />
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
          <span style={{ width: `${(wins.a / matches.length) * 100}%`, background: TEAM_COLORS.a }} />
          <span style={{ width: `${(wins.b / matches.length) * 100}%`, background: TEAM_COLORS.b }} />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>{matches.length} partidas</span>
          <span>
            Duração média <b className="font-mono text-foreground">{formatDuration(average)}</b>
          </span>
          <span>
            Mais longa <b className="font-mono text-foreground">{formatDuration(longest)}</b>
          </span>
        </div>
      </div>
      <HeroList title="Mais escolhidos" entries={top(picks)} showWins />
      {/* Bans só existem nos drafts feitos aqui; partidas importadas pelo ID não têm. */}
      {bans.size > 0 && <HeroList title="Mais banidos" entries={top(bans)} />}
    </section>
  )
}

function SideScore({ team, wins, reverse }: { team: Team; wins: number; reverse?: boolean }) {
  return (
    <span className={`flex items-center gap-2 ${reverse ? "flex-row-reverse" : ""}`} style={{ color: TEAM_COLORS[team] }}>
      <TeamIcon team={team} className="h-6 w-6" />
      <span className="text-sm">{TEAM_NAMES[team]}</span>
      <span className="text-2xl text-foreground">{wins}</span>
    </span>
  )
}

function HeroList({ title, entries, showWins }: { title: string; entries: HeroCount[]; showWins?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      <ul className="flex gap-2">
        {entries.map(({ hero, count, wins }) => (
          <li key={hero.id} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.card} alt={hero.name} title={hero.name} className="hero-face h-12 w-10 rounded-md" />
            <span className="font-mono text-xs font-bold tabular-nums">{count}×</span>
            {showWins && (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground" title="Vitórias com o herói">
                {Math.round((wins / count) * 100)}% V
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function HistoryFilters({ filter, counts }: { filter: HistoryFilter; counts: Record<HistoryFilter, number> }) {
  const options: { value: HistoryFilter; label: string }[] = [
    { value: "todas", label: "Todas" },
    { value: "minhas", label: "Que eu joguei" },
    { value: "pendentes", label: "Pendentes" },
  ]
  return (
    <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Filtrar partidas">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.value === "todas" ? "/historico" : `/historico?filtro=${o.value}`}
          scroll={false}
          aria-current={filter === o.value ? "page" : undefined}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            filter === o.value
              ? "border-foreground/40 bg-muted text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label} <span className="font-mono opacity-60">{counts[o.value]}</span>
        </Link>
      ))}
    </nav>
  )
}

// Rótulo do dia de uma partida, no horário de Brasília: "Hoje", "Ontem" ou "21 de outubro".
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
const dayLong = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })
const dayLongYear = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })

export function dayOf(draft: SavedDraft) {
  // Partidas de print ainda não têm o horário real: ficam juntas no fim.
  if (!draft.verified) return { key: "pendentes", label: "Pendentes de confirmação" }
  const key = dayKey.format(draft.playedAt)
  const today = dayKey.format(Date.now())
  const yesterday = dayKey.format(Date.now() - 86_400_000)
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  const label = key === today ? "Hoje" : key === yesterday ? "Ontem" : (sameYear ? dayLong : dayLongYear).format(draft.playedAt)
  return { key, label }
}

// Placar de abates do time (soma dos jogadores), com o vencedor em destaque.
export function KillScore({ draft }: { draft: SavedDraft }) {
  const kills = (team: Team) => draft.stats.filter((p) => p.team === team).reduce((sum, p) => sum + p.kills, 0)
  return (
    <span className="font-mono text-xs font-bold tabular-nums" title="Abates de cada time">
      <span
        style={{ color: draft.winner === "a" ? TEAM_COLORS.a : undefined }}
        className={draft.winner === "a" ? "" : "text-muted-foreground"}
      >
        {kills("a")}
      </span>
      <span className="mx-1 text-muted-foreground">×</span>
      <span
        style={{ color: draft.winner === "b" ? TEAM_COLORS.b : undefined }}
        className={draft.winner === "b" ? "" : "text-muted-foreground"}
      >
        {kills("b")}
      </span>
    </span>
  )
}
