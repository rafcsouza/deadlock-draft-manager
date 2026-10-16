import type { Hero } from "@/lib/heroes"
import { HeroCard } from "@/components/hero-card"

// Painel ilustrativo de um draft em andamento, usado na home.
export function DraftPreview({ heroes }: { heroes: Hero[] }) {
  const pick = (i: number) => heroes[i]
  const picksA = [pick(0), pick(2), undefined]
  const picksB = [pick(1), pick(3), undefined]
  const bansA = [pick(4), pick(6)]
  const bansB = [pick(5), pick(7)]

  return (
    <div className="relative rounded-2xl border border-border bg-card/80 p-4 shadow-2xl shadow-black/50 backdrop-blur sm:p-5">
      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-bold" style={{ color: "var(--team-a)" }}>
          <span className="h-2 w-2 rounded-full bg-team-a" /> Hidden King
        </span>
        <span className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 font-mono text-[11px]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
          PICK · 0:24
        </span>
        <span className="flex items-center gap-1.5 font-bold" style={{ color: "var(--team-b)" }}>
          Archmother <span className="h-2 w-2 rounded-full bg-team-b" />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <TeamColumn picks={picksA} bans={bansA} team="a" />
        <TeamColumn picks={picksB} bans={bansB} team="b" />
      </div>
    </div>
  )
}

function TeamColumn({
  picks,
  bans,
  team,
}: {
  picks: (Hero | undefined)[]
  bans: (Hero | undefined)[]
  team: "a" | "b"
}) {
  const align = team === "b" ? "text-right" : ""
  return (
    <div className="space-y-3">
      <p className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${align}`}>Picks</p>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {picks.map((h, i) => (
          <HeroCard key={i} hero={h} team={team} />
        ))}
      </div>
      <p className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${align}`}>Bans</p>
      <div className={`grid grid-cols-3 gap-1.5 sm:gap-2 ${team === "b" ? "[direction:rtl]" : ""}`}>
        {bans.map((h, i) => (
          <HeroCard key={i} hero={h} banned className="[direction:ltr]" />
        ))}
      </div>
    </div>
  )
}
