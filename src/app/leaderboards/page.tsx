import Link from "next/link"
import { requireUser } from "@/lib/auth"
import { getHeroes } from "@/lib/heroes"
import { BackLink } from "@/components/back-link"
import { SoundMenu } from "@/components/sound-toggle"
import { InfoButton } from "@/components/info-button"
import { Awards, EloBadge, FormDots, Pairs, Podium, ProvisionalList } from "@/components/leaderboard-extras"
import { ELO, getLeaderboard, MIN_MATCHES, POINTS, type LeaderboardRow } from "@/lib/leaderboard"
import { getLeaderboardExtras } from "@/lib/leaderboard-extras"

export const metadata = { title: "Leaderboards" }

const kdaOf = (r: LeaderboardRow) => (r.kills + r.assists) / Math.max(r.deaths, 1)

// Colunas que ordenam a tabela ao clicar no título. Sempre do maior para o menor, menos mortes.
const SORTS = {
  pontos: { value: (r: LeaderboardRow) => r.rating },
  elo: { value: (r: LeaderboardRow) => r.elo },
  partidas: { value: (r: LeaderboardRow) => r.matches },
  vitorias: { value: (r: LeaderboardRow) => r.wins / r.matches },
  mvps: { value: (r: LeaderboardRow) => r.mvps },
  sequencia: { value: (r: LeaderboardRow) => r.streak },
  abates: { value: (r: LeaderboardRow) => r.kills },
  mortes: { value: (r: LeaderboardRow) => -r.deaths },
  assistencias: { value: (r: LeaderboardRow) => r.assists },
  kda: { value: kdaOf },
}
type SortKey = keyof typeof SORTS

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<{ ordem?: string; modo?: string }> }) {
  const user = await requireUser("/leaderboards")
  const params = await searchParams
  const asked = params.ordem ?? (params.modo === "elo" ? "elo" : "pontos")
  const sort: SortKey = asked in SORTS ? (asked as SortKey) : "pontos"
  // Posições, setas e pódio seguem os pontos, ou o Elo quando a ordem é por Elo.
  const elo = sort === "elo"
  const rows = getLeaderboard(elo ? "elo" : "pontos")
  // Ordem por outra coluna: só reordena (empate fica na ordem do ranking) e numera de 1 em diante.
  const byPosition = sort === "pontos" || sort === "elo"
  const heroes = new Map((await getHeroes()).map((h) => [h.id, h]))
  const extras = getLeaderboardExtras(rows)
  // Quem está em avaliação sai da tabela e vai para uma lista recolhida no fim.
  const podium = rows.filter((r) => !r.provisional)
  const ranked = byPosition ? podium : [...podium].sort((a, b) => SORTS[sort].value(b) - SORTS[sort].value(a))
  const provisional = rows.filter((r) => r.provisional)

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <BackLink />
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Leaderboard</h1>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} jogadores</span>
        <InfoButton title="Como funciona o ranking">
          <ScoringHelp />
        </InfoButton>
        <SoundMenu label />
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/80 p-10 text-center text-sm text-muted-foreground">
          Nenhuma partida no histórico ainda.
        </p>
      ) : (
        <>
        <Podium rows={podium} heroes={heroes} elo={elo} />
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/80 p-3">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="whitespace-nowrap [&>th]:px-1.5 [&>th]:pb-2 [&>th]:font-semibold">
                <th className="w-10 text-center">#</th>
                <th>Jogador</th>
                <SortHeader sort={sort} by="pontos" label="Pontos" className="text-right" />
                <SortHeader sort={sort} by="elo" label="Elo" />
                <SortHeader sort={sort} by="partidas" label="Jogos" title="Partidas jogadas" className="text-center" />
                <th className="text-center">V–D</th>
                <SortHeader sort={sort} by="vitorias" label="% Vit." title="Porcentagem de vitórias" className="text-right" />
                <SortHeader sort={sort} by="mvps" label="MVPs" className="text-center" />
                <SortHeader sort={sort} by="sequencia" label="Seq." title="Sequência atual" className="text-center" />
                <th className="text-center">Últimas</th>
                <SortHeader sort={sort} by="abates" label="K" title="Abates" className="text-right" />
                <SortHeader sort={sort} by="mortes" label="M" title="Mortes (menos primeiro)" className="text-right" />
                <SortHeader sort={sort} by="assistencias" label="A" title="Assistências" className="text-right" />
                <SortHeader sort={sort} by="kda" label="KDA" className="text-right" />
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => {
                const kda = kdaOf(r)
                const position = byPosition ? r.rank : i + 1
                const me = r.userId === String(user.id)
                const hero = r.topHero ? heroes.get(r.topHero.heroId) : undefined
                return (
                  <tr key={r.accountId} className={`border-t border-border/60 [&>td]:whitespace-nowrap [&>td]:px-1.5 [&>td]:py-2 ${me ? "bg-muted/60" : ""}`}>
                    <td className="text-center">
                      <span className={`block font-display text-base font-bold leading-tight ${position !== null && position <= 3 ? "text-yellow-300" : "text-muted-foreground"}`}>
                        {position ?? "–"}
                      </span>
                      {byPosition && <RankChange change={r.rankChange} ranked={r.rank !== null} />}
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
                        <Link href={`/jogador/${r.accountId}`} title={r.name}
                          className={`max-w-[10rem] truncate whitespace-nowrap hover:underline ${r.hasProfile ? "font-semibold" : "text-foreground/80"}`}>
                          {r.name}
                        </Link>
                        {r.hasProfile && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">perfil</span>}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap text-right ${elo ? "opacity-70" : ""}`}>
                      <span className="font-mono font-bold tabular-nums">{r.rating}</span>
                      {r.lastChange > 0 && <span className="ml-1.5 font-mono text-[11px] tabular-nums text-green-400">+{r.lastChange}</span>}
                    </td>
                    <td className={`!pr-4 ${elo ? "" : "opacity-70"}`}>
                      {r.eloCalibrating ? (
                        <span
                          className="whitespace-nowrap text-[11px] text-muted-foreground"
                          title={`O Elo aparece a partir de ${ELO.minMatches} partidas`}
                        >
                          Em calibração ({r.matches}/{ELO.minMatches})
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <EloBadge elo={r.elo} label />
                          <span className="font-mono font-bold tabular-nums">{r.elo}</span>
                          {r.eloChange !== 0 && (
                            <span className={`font-mono text-[11px] tabular-nums ${r.eloChange > 0 ? "text-green-400" : "text-red-400"}`}>
                              {r.eloChange > 0 ? `+${r.eloChange}` : r.eloChange}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="text-center font-mono tabular-nums">{r.matches}</td>
                    <td className="whitespace-nowrap text-center font-mono tabular-nums">
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

    </main>
  )
}

// Explicação da pontuação, do Elo e da tabela (aberta pelo botão "i" no topo).
function ScoringHelp() {
  return (
    <div className="mt-4 space-y-4">
      <section>
        <p className="font-semibold text-foreground">Pontos</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Todo mundo começa com 0 pontos, e ninguém perde pontos.</li>
          <li>Vitória: +{POINTS.win}. Derrota: nada.</li>
          <li>
            Sequência de vitórias: a 2ª vitória seguida vale +{POINTS.winStreak2}, e da 3ª em diante +{POINTS.winStreak3}.
          </li>
          <li>
            Os 3 melhores da partida ganham bônus, mesmo no time que perdeu: MVP +{POINTS.mvpBonus[1]}, 2º +{POINTS.mvpBonus[2]}, 3º +
            {POINTS.mvpBonus[3]}.
          </li>
          <li>Empate em pontos: fica na frente quem tem mais vitórias, depois o melhor KDA.</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold text-foreground">Elo</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Todo mundo começa com {ELO.start}. O Elo não cresce só por jogar mais: cada partida pode subir ou descer.</li>
          <li>
            Antes de cada partida, a média de Elo dos dois times dá a chance de vitória de cada um. Ganhar de um time mais forte
            sobe mais; perder para um time mais fraco desce mais (até {ELO.k} por partida).
          </li>
          <li>
            Os 3 melhores da partida ganham um bônus, mesmo perdendo: MVP +{ELO.mvpBonus[1]}, 2º +{ELO.mvpBonus[2]}, 3º +
            {ELO.mvpBonus[3]}.
          </li>
          <li>
            Com menos de {ELO.minMatches} partidas o Elo fica &quot;em calibração&quot;: ainda é calculado, mas não aparece e, na ordem
            por Elo, a pessoa fica no fim, sem posição.
          </li>
          <li>A patente segue as do Deadlock: começa em Mystic 1, e cada patente (de Initiate a Eternus) vale 40 de Elo.</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold text-foreground">Tabela</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Clique no título de uma coluna (Pontos, Elo, Jogos, % Vit., K, M, A, KDA...) para ordenar por ela.</li>
          <li>As setas mostram quantas posições cada um subiu (▲) ou caiu (▼) com a última partida.</li>
          <li>As bolinhas mostram as últimas 5 partidas (verde vitória, vermelho derrota; a mais recente à direita).</li>
          <li>K, M e A são o total de abates, mortes e assistências; o KDA é (abates + assistências) ÷ mortes.</li>
          <li>
            Com menos de {MIN_MATCHES} partidas, o jogador fica &quot;em avaliação&quot;: fora da tabela, numa lista recolhida logo
            abaixo dela.
          </li>
          <li>Prêmios, duplas e rivalidades contam só quem já tem posição; duplas e rivalidades precisam de pelo menos 3 partidas.</li>
        </ul>
      </section>
    </div>
  )
}

// Título de coluna que ordena a tabela; a seta mostra a coluna da ordem atual.
function SortHeader({ sort, by, label, title, className = "" }: { sort: SortKey; by: SortKey; label: string; title?: string; className?: string }) {
  const active = sort === by
  return (
    <th className={className} aria-sort={active ? (by === "mortes" ? "ascending" : "descending") : undefined}>
      <Link
        href={by === "pontos" ? "/leaderboards" : `/leaderboards?ordem=${by}`}
        scroll={false}
        title={`Ordenar por ${title ?? label}`}
        className={`transition-colors hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <span className={active ? "" : "invisible"}> {by === "mortes" ? "▲" : "▼"}</span>
      </Link>
    </th>
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
