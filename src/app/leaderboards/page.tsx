import Link from "next/link"
import { Logo } from "@/components/logo"
import { requireUser } from "@/lib/auth"
import { getLeaderboard, POINTS } from "@/lib/leaderboard"

export const metadata = { title: "Leaderboards" }

export default async function LeaderboardsPage() {
  const user = await requireUser("/leaderboards")
  const rows = getLeaderboard()

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/" aria-label="Voltar para o início">
          <Logo className="h-6 w-6" />
        </Link>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Leaderboard</h1>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} jogadores</span>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/80 p-10 text-center text-sm text-muted-foreground">
          Nenhuma partida no histórico ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/80 p-3">
          <table className="w-full min-w-[720px] text-left text-sm">
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
                <th className="text-right">KDA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const kda = (r.kills + r.assists) / Math.max(r.deaths, 1)
                const me = r.userId === String(user.id)
                return (
                  <tr key={r.accountId} className={`border-t border-border/60 [&>td]:px-2 [&>td]:py-2 ${me ? "bg-muted/60" : ""}`}>
                    <td className={`text-center font-display text-base font-bold ${i < 3 ? "text-yellow-300" : "text-muted-foreground"}`}>
                      {i + 1}
                    </td>
                    <td>
                      <Link href={`/jogador/${r.accountId}`} className={`hover:underline ${r.hasProfile ? "font-semibold" : "text-foreground/80"}`}>
                        {r.name}
                      </Link>
                      {r.hasProfile && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">perfil</span>}
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
                    <td className={`text-center font-mono tabular-nums ${r.streak > 0 ? "text-green-400" : "text-red-400"}`}>
                      {r.streak > 0 ? `${r.streak}V` : `${-r.streak}D`}
                    </td>
                    <td className="text-right font-mono tabular-nums">{kda.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
        </ul>
      </details>
    </main>
  )
}
