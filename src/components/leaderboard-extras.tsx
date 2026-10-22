import Link from "next/link"
import type { Hero } from "@/lib/heroes"
import type { LeaderboardRow } from "@/lib/leaderboard"
import type { Award, Pair } from "@/lib/leaderboard-extras"

type HeroMap = Map<number, Hero>

const PODIUM = [
  { place: 2, medal: "🥈", height: "h-12", ring: "ring-zinc-300/60", text: "text-zinc-200" },
  { place: 1, medal: "👑", height: "h-16", ring: "ring-yellow-300/80", text: "text-yellow-300" },
  { place: 3, medal: "🥉", height: "h-9", ring: "ring-amber-700/70", text: "text-amber-500" },
]

// Os três primeiros em destaque, com o retrato "on fire" do herói mais jogado de cada um.
export function Podium({ rows, heroes }: { rows: LeaderboardRow[]; heroes: HeroMap }) {
  const top = rows.filter((r) => r.rank !== null && r.rank <= 3)
  if (top.length < 3) return null
  return (
    <section className="mb-5 grid grid-cols-3 items-end gap-2 sm:gap-4">
      {PODIUM.map(({ place, medal, height, ring, text }) => {
        const r = top.find((x) => x.rank === place)!
        const hero = r.topHero ? heroes.get(r.topHero.heroId) : undefined
        return (
          <Link key={place} href={`/jogador/${r.accountId}`} className="group flex flex-col items-center gap-2 text-center">
            <span className="text-2xl">{medal}</span>
            <span className={`relative block aspect-[3/4] w-full max-w-[8rem] overflow-hidden rounded-xl bg-muted ring-2 ${ring} ${place === 1 ? "shadow-[0_0_32px_rgba(253,224,71,0.35)]" : ""}`}>
              {hero && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero.gloat} alt={hero.name} className="hero-face h-full w-full transition-transform duration-300 group-hover:scale-105" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-6">
                <span className="block truncate text-sm font-bold text-white">{r.name}</span>
                <span className={`font-mono text-xs font-bold tabular-nums ${text}`}>{r.rating} pts</span>
              </span>
            </span>
            <span className={`flex w-full ${height} items-start justify-center rounded-t-xl border border-b-0 border-border bg-card/80 pt-2`}>
              <span className={`font-display text-2xl font-bold ${text}`}>{place}</span>
            </span>
          </Link>
        )
      })}
    </section>
  )
}

// Últimas partidas em bolinhas: verde vitória, vermelho derrota (a mais recente à direita).
export function FormDots({ form }: { form: boolean[] | undefined }) {
  if (!form?.length) return null
  return (
    <span className="inline-flex gap-1" title={form.map((w) => (w ? "V" : "D")).join(" ")}>
      {form.map((won, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${won ? "bg-green-500" : "bg-red-500/80"} ${i === form.length - 1 ? "ring-2 ring-white/30" : ""}`}
        />
      ))}
    </span>
  )
}

// Prêmios por estatística, como os destaques de fim de temporada.
export function Awards({ awards, heroes }: { awards: Award[]; heroes: HeroMap }) {
  if (!awards.length) return null
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide">Prêmios</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {awards.map((a) => {
          const hero = a.heroId !== null ? heroes.get(a.heroId) : undefined
          return (
            <Link
              key={a.key}
              href={`/jogador/${a.accountId}`}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/80 p-3 transition-colors hover:border-foreground/30"
            >
              {hero && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero.card} alt="" className="hero-face pointer-events-none absolute -right-3 top-0 h-full w-20 opacity-20 transition-opacity group-hover:opacity-35 [mask-image:linear-gradient(to_left,black,transparent)]" />
              )}
              <span className="relative block text-2xl">{a.icon}</span>
              <span className="relative mt-1 block font-display text-sm font-bold uppercase tracking-wide">{a.title}</span>
              <span className="relative block text-[11px] text-muted-foreground">{a.description}</span>
              <span className="relative mt-2 block truncate text-sm font-semibold">{a.name}</span>
              <span className="relative block font-mono text-xs tabular-nums text-muted-foreground">{a.value}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// Melhor dupla, dupla que não combina e o maior freguês.
export function Pairs({ bestDuo, worstDuo, rivalry }: { bestDuo: Pair | null; worstDuo: Pair | null; rivalry: Pair | null }) {
  const cards = [
    bestDuo && { key: "best", icon: "🤝", title: "Dupla de ouro", pair: bestDuo, joiner: "+", line: `${bestDuo.wins} vitórias em ${bestDuo.games} juntos` },
    worstDuo && {
      key: "worst",
      icon: "💔",
      title: "Não dá liga",
      pair: worstDuo,
      joiner: "+",
      line: `${worstDuo.games - worstDuo.wins} derrotas em ${worstDuo.games} juntos`,
    },
    rivalry && {
      key: "rival",
      icon: "😈",
      title: "Freguesia",
      pair: rivalry,
      joiner: "vs",
      line: `${rivalry.a.name} ganhou ${rivalry.wins} de ${rivalry.games} confrontos`,
    },
  ].filter((c) => !!c)
  if (!cards.length) return null
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide">Duplas e rivalidades</h2>
      <div className="grid gap-2 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className="rounded-2xl border border-border bg-card/80 p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {c.icon} {c.title}
            </p>
            <p className="mt-1.5 text-sm font-semibold">
              <Link href={`/jogador/${c.pair.a.accountId}`} className="hover:underline">
                {c.pair.a.name}
              </Link>
              <span className="mx-1.5 text-muted-foreground">{c.joiner}</span>
              <Link href={`/jogador/${c.pair.b.accountId}`} className="hover:underline">
                {c.pair.b.name}
              </Link>
            </p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{c.line}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// Quem ainda não tem partidas suficientes: fica recolhido no fim, numa lista compacta.
export function ProvisionalList({ rows, minMatches }: { rows: LeaderboardRow[]; minMatches: number }) {
  if (!rows.length) return null
  return (
    <details className="mt-3 rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
        Em avaliação: {rows.length} {rows.length === 1 ? "jogador" : "jogadores"} com menos de {minMatches} partidas
      </summary>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <li key={r.accountId}>
            <Link
              href={`/jogador/${r.accountId}`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              {r.name}
              <span className="font-mono tabular-nums text-muted-foreground">
                {r.wins}–{r.losses}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}
