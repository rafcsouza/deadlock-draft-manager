import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Logo } from "@/components/logo"
import { requireUser } from "@/lib/auth"
import { avatarUrl } from "@/lib/avatar"
import { db } from "@/lib/db"
import { TEAM_NAMES } from "@/lib/draft-rules"
import { listDrafts } from "@/lib/drafts"
import { formatDuration, formatSouls } from "@/lib/format"
import { getHeroes } from "@/lib/heroes"
import { getLeaderboard, MIN_MATCHES } from "@/lib/leaderboard"
import { getAccountLinks } from "@/lib/players"
import { toSteam64 } from "@/lib/steam"

export const metadata = { title: "Perfil do jogador" }

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" })

export default async function PlayerPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId: raw } = await params
  await requireUser(`/jogador/${raw}`)
  const accountId = Number(raw)
  if (!Number.isSafeInteger(accountId) || accountId <= 0) notFound()

  // Conta secundária de alguém: mostra o perfil da conta principal.
  const mainId = getAccountLinks().main(accountId)
  if (mainId !== accountId) redirect(`/jogador/${mainId}`)

  const board = getLeaderboard()
  const row = board.find((r) => r.accountId === accountId)
  if (!row) notFound()

  const heroes = new Map((await getHeroes()).map((h) => [h.id, h]))
  const profile = db
    .prepare(`SELECT id, avatar FROM users WHERE steam_account_id IN (${row.accounts.map(() => "?").join(",")})`)
    .get(...row.accounts) as
    | { id: number; avatar: string | null }
    | undefined
  const avatar = profile ? avatarUrl(profile.id, profile.avatar) : null

  // Partidas do jogador (só as confirmadas pela API, as mesmas do leaderboard), da mais recente para a mais antiga.
  const changeByDraft = new Map(row.history.map((h) => [h.draftId, h.change]))
  const games = listDrafts(100000)
    .filter((m) => m.verified)
    .flatMap((m) => {
      const me = m.stats.find((p) => row.accounts.includes(p.accountId))
      return me ? [{ match: m, me, won: me.team === m.winner }] : []
    })

  const n = Math.max(games.length, 1)
  const avg = (f: (g: (typeof games)[number]) => number) => Math.round(games.reduce((s, g) => s + f(g), 0) / n)
  const kda = (row.kills + row.assists) / Math.max(row.deaths, 1)

  // Heróis mais jogados, com vitórias.
  const heroStats = new Map<number, { games: number; wins: number }>()
  for (const g of games) {
    const h = heroStats.get(g.me.heroId) ?? { games: 0, wins: 0 }
    h.games++
    if (g.won) h.wins++
    heroStats.set(g.me.heroId, h)
  }
  const topHeroes = [...heroStats].sort((a, b) => b[1].games - a[1].games || b[1].wins - a[1].wins)

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-5 px-4 py-8">
      <header className="flex items-center gap-3">
        <Link href="/leaderboards" aria-label="Voltar para o leaderboard">
          <Logo className="h-6 w-6" />
        </Link>
        <Link href="/leaderboards" className="text-xs text-muted-foreground hover:text-foreground">
          ← Leaderboard
        </Link>
      </header>

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card/80 p-5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted font-display text-2xl font-bold uppercase">
            {row.name.slice(0, 2)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-bold tracking-wide">{row.name}</h1>
          <p className="text-xs text-muted-foreground">
            {row.rank !== null ? `#${row.rank} no leaderboard` : `em avaliação (menos de ${MIN_MATCHES} partidas)`} · {row.hasProfile ? "tem perfil no site" : "sem perfil no site"} ·{" "}
            {row.accounts.map((id, i) => (
              <span key={id}>
                {i > 0 && " · "}
                <a
                  href={`https://steamcommunity.com/profiles/${toSteam64(id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {row.accounts.length > 1 ? `conta Steam ${i + 1}` : "perfil na Steam"}
                </a>
              </span>
            ))}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-bold tabular-nums">{row.rating}</p>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">pontos</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Partidas" value={String(row.matches)} />
        <Stat label="Vitórias" value={`${row.wins}–${row.losses} (${Math.round((row.wins / row.matches) * 100)}%)`} />
        <Stat label="KDA" value={kda.toFixed(2)} sub={`${row.kills}/${row.deaths}/${row.assists}`} />
        <Stat label="MVPs" value={String(row.mvps)} sub={`melhor sequência: ${row.bestStreak}V`} />
        <Stat label="Almas por partida" value={formatSouls(avg((g) => g.me.netWorth))} />
        <Stat label="Dano em jogadores" value={formatSouls(avg((g) => g.me.damage))} sub="por partida" />
        <Stat label="Dano em objetivos" value={formatSouls(avg((g) => g.me.objDamage))} sub="por partida" />
        <Stat label="Cura" value={formatSouls(avg((g) => g.me.healing))} sub="por partida" />
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-4">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Heróis</h2>
        <div className="flex flex-wrap gap-3">
          {topHeroes.map(([heroId, h]) => {
            const hero = heroes.get(heroId)
            return (
              <div key={heroId} className="flex items-center gap-2 rounded-lg bg-muted/50 py-1 pl-1 pr-3">
                {hero && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hero.card} alt="" className="h-9 w-9 rounded object-cover object-top" />
                )}
                <div className="text-xs">
                  <p className="font-semibold">{hero?.name ?? "?"}</p>
                  <p className="text-muted-foreground">
                    {h.games} {h.games === 1 ? "partida" : "partidas"} · {h.wins}V
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-3">
        <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Partidas</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="[&>th]:px-2 [&>th]:pb-2 [&>th]:font-semibold">
                <th>Data</th>
                <th>Herói</th>
                <th>Resultado</th>
                <th className="text-center">V/M/A</th>
                <th className="text-right">Almas</th>
                <th className="text-right">Dano jog.</th>
                <th className="text-right">Duração</th>
                <th className="text-right">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {games.map(({ match, me, won }) => {
                const hero = heroes.get(me.heroId)
                const change = changeByDraft.get(match.id) ?? 0
                return (
                  <tr key={match.id} className="border-t border-border/60 [&>td]:px-2 [&>td]:py-1.5">
                    <td className="text-xs text-muted-foreground">{dateFormat.format(match.playedAt)}</td>
                    <td>
                      <span className="flex items-center gap-2">
                        {hero && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hero.card} alt="" className="h-7 w-7 rounded object-cover object-top" />
                        )}
                        <span className="text-xs">{hero?.name}</span>
                        {me.mvpRank === 1 && <span className="rounded bg-yellow-500/25 px-1 text-[9px] font-black text-yellow-300">MVP</span>}
                      </span>
                    </td>
                    <td className={`text-xs font-bold ${won ? "text-green-400" : "text-red-400"}`}>
                      {won ? "Vitória" : "Derrota"}
                      <span className="ml-1 font-normal text-muted-foreground">({TEAM_NAMES[me.team]})</span>
                    </td>
                    <td className="text-center font-mono tabular-nums">
                      {me.kills}/{me.deaths}/{me.assists}
                    </td>
                    <td className="text-right font-mono tabular-nums">{formatSouls(me.netWorth)}</td>
                    <td className="text-right font-mono tabular-nums">{formatSouls(me.damage)}</td>
                    <td className="text-right font-mono tabular-nums text-muted-foreground">{formatDuration(match.durationS)}</td>
                    <td className={`text-right font-mono tabular-nums ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {change >= 0 ? "+" : ""}
                      {change}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
