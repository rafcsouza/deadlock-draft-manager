import Link from "next/link"
import { requireUser } from "@/lib/auth"
import { getHeroes } from "@/lib/heroes"
import { BackLink } from "@/components/back-link"
import { SoundMenu } from "@/components/sound-toggle"
import { Awards, FormDots, Pairs, Podium, ProvisionalList } from "@/components/leaderboard-extras"
import { getLeaderboard, MIN_MATCHES, POINTS } from "@/lib/leaderboard"
import { getLeaderboardExtras } from "@/lib/leaderboard-extras"

export const metadata = { title: "Leaderboards" }

export default async function LeaderboardsPage() {
  const user = await requireUser("/leaderboards")
  const rows = getLeaderboard()
  const heroes = new Map((await getHeroes()).map((h) => [h.id, h]))
  const extras = getLeaderboardExtras(rows)
  // Quem está em avaliação sai da tabela e vai para uma lista recolhida no fim.
  const ranked = rows.filter((r) => !r.provisional)
  const provisional = rows.filter((r) => r.provisional)

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <BackLink />
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Leaderboard</h1>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} jogadores</span>
        <SoundMenu label />
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/80 p-10 text-center text-sm text-muted-foreground">
          Nenhuma partida no histórico ainda.
        </p>
      ) : (
        <>
        <Podium rows={ranked} heroes={heroes} />
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/80 p-3">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="[&>th]:px-2 [&>th]:pb-2 [&>th]:font-semibold">
                <th className="w-10 text-center">#</th>
                <th>Jogador</th>
                <th className="text-right">Pontos</th>
                <th className="text-center">Partidas</th>
                <th className="text-center">V–D</th>
                <th className="text-right">Vitórias</th>
                <th className="text-center">MVPs</th>
                <th className="text-center">Sequência</th>
                <th className="text-center">Últimas</th>
                <th className="text-right" title="Abates">K</th>
                <th className="text-right" title="Mortes">M</th>
                <th className="text-right" title="Assistências">A</th>
                <th className="text-right">KDA</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const kda = (r.kills + r.assists) / Math.max(r.deaths, 1)
                const me = r.userId === String(user.id)
                const hero = r.topHero ? heroes.get(r.topHero.heroId) : undefined
                return (
                  <tr key={r.accountId} className={`border-t border-border/60 [&>td]:px-2 [&>td]:py-2 ${me ? "bg-muted/60" : ""}`}>
                    <td className="text-center">
                      <span className={`block font-display text-base font-bold leading-tight ${r.rank !== null && r.rank <= 3 ? "text-yellow-300" : "text-muted-foreground"}`}>
                        {r.rank ?? "–"}
                      </span>
                      <RankChange change={r.rankChange} ranked={r.rank !== null} />
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        {hero ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={hero.card}
                            alt={hero.name}
                            title={`Mais jogado: ${hero.name} (${r.topHero!.matches} ${r.topHero!.matches === 1 ? "partida" : "partidas"})`}
                            className="hero-face h-8 w-6 shrink-0 rounded"
                          />
                        ) : (
                          <span className="h-8 w-6 shrink-0 rounded bg-muted" />
                        )}
                        <Link href={`/jogador/${r.accountId}`} className={`hover:underline ${r.hasProfile ? "font-semibold" : "text-foreground/80"}`}>
                          {r.name}
                        </Link>
                        {r.hasProfile && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">perfil</span>}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="font-mono font-bold tabular-nums">{r.rating}</span>
                      <span className="ml-1.5 font-mono text-[11px] tabular-nums text-green-400">+{r.lastChange}</span>
                    </td>
                    <td className="text-center font-mono tabular-nums">{r.matches}</td>
                    <td className="text-center font-mono tabular-nums">
                      {r.wins}–{r.losses}
                    </td>
                    <td className="text-right font-mono tabular-nums">{Math.round((r.wins / r.matches) * 100)}%</td>
                    <td className="text-center font-mono tabular-nums">{r.mvps || "–"}</td>
                    <td
                      className={`text-center font-mono tabular-nums ${r.streak > 0 ? "text-green-400" : "text-red-400"}`}
                      title={r.streak >= 2 ? `${r.streak} vitórias seguidas` : r.streak <= -2 ? `${-r.streak} derrotas seguidas` : undefined}
                    >
                      {r.streak >= 2 && "🔥 "}
                      {r.streak <= -2 && "🧊 "}
                      {r.streak > 0 ? `${r.streak}V` : `${-r.streak}D`}
                    </td>
                    <td className="text-center">
                      <FormDots form={extras.form.get(r.accountId)} />
                    </td>
                    <td className="text-right font-mono tabular-nums">{r.kills}</td>
                    <td className="text-right font-mono tabular-nums">{r.deaths}</td>
                    <td className="text-right font-mono tabular-nums">{r.assists}</td>
                    <td className="text-right font-mono font-semibold tabular-nums">{kda.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <ProvisionalList rows={provisional} minMatches={MIN_MATCHES} />
        <Awards awards={extras.awards} heroes={heroes} />
        <Pairs bestDuo={extras.bestDuo} worstDuo={extras.worstDuo} rivalry={extras.rivalry} />
        </>
      )}

      <details className="mt-4 rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground">Como os pontos são calculados</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Todo mundo começa com 0 pontos, e ninguém perde pontos.</li>
          <li>
            Vitória: +{POINTS.win}. Derrota: +{POINTS.loss}.
          </li>
          <li>
            Sequência de vitórias: a 2ª vitória seguida vale +{POINTS.winStreak2}, e da 3ª em diante +{POINTS.winStreak3}.
          </li>
          <li>Bônus de MVP da partida (mesmo na derrota): MVP +{POINTS.mvpBonus[1]}, 2º +{POINTS.mvpBonus[2]}.</li>
          <li>Empate em pontos: fica na frente quem tem mais vitórias, depois o melhor KDA.</li>
          <li>K, M e A são o total de abates, mortes e assistências; o KDA é (abates + assistências) ÷ mortes.</li>
          <li>Com menos de {MIN_MATCHES} partidas, o jogador fica "em avaliação": fica fora da tabela, numa lista recolhida logo abaixo dela.</li>
          <li>As bolinhas mostram as últimas 5 partidas (verde vitória, vermelho derrota; a mais recente à direita).</li>
          <li>Prêmios, duplas e rivalidades contam só quem já tem posição; duplas e rivalidades precisam de pelo menos 3 partidas.</li>
          <li>As setas mostram quantas posições cada um subiu (▲) ou caiu (▼) com a última partida.</li>
        </ul>
      </details>
    </main>
  )
}

// Seta de quantas posições o jogador subiu ou caiu com a última partida.
function RankChange({ change, ranked }: { change: number | null; ranked: boolean }) {
  if (!ranked) return null
  if (change === null) return <span className="block text-[9px] font-semibold uppercase text-sky-400">novo</span>
  if (change === 0) return null
  return (
    <span className={`block font-mono text-[10px] font-bold tabular-nums ${change > 0 ? "text-green-400" : "text-red-400"}`}>
      {change > 0 ? `▲${change}` : `▼${-change}`}
    </span>
  )
}
