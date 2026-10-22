import { Collapsible } from "@/components/collapsible"
import { DraftTimeline } from "@/components/draft-timeline"
import { ImportMatchForm, VerifyMatchForm } from "@/components/import-match-form"
import { Scoreboard } from "@/components/scoreboard"
import { requireUser } from "@/lib/auth"
import { buildPlayerSteps, TEAM_COLORS, TEAM_NAMES, type PlayerView, type Team } from "@/lib/draft-rules"
import { listDrafts, type SavedDraft } from "@/lib/drafts"
import { formatDateTime, formatDuration, playerName } from "@/lib/format"
import { getHeroes, type Hero } from "@/lib/heroes"
import { getItems, type ShopItem } from "@/lib/items"
import { BackLink } from "@/components/back-link"
import { getProfilesBySteam } from "@/lib/players"

export const metadata = { title: "Histórico de partidas" }

export default async function HistoryPage() {
  const user = await requireUser("/historico")
  // Nome e perfil de cada jogador vêm dos perfis atuais (pelo SteamID), não do que foi gravado na importação.
  const profiles = getProfilesBySteam()
  const drafts = listDrafts().map((d) => ({
    ...d,
    stats: d.stats.map((p) => {
      const u = profiles.get(p.accountId)
      return { ...p, userId: u ? String(u.id) : null, name: u?.username ?? null }
    }),
  }))
  const [heroList, itemList] = await Promise.all([getHeroes(), getItems()])
  const heroes = new Map(heroList.map((h) => [h.id, h]))
  const items = new Map(itemList.map((i) => [i.id, i]))

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <BackLink />
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Histórico de partidas</h1>
        <span className="ml-auto text-xs text-muted-foreground">{drafts.length} partidas</span>
      </header>

      <ImportMatchForm heroes={heroList.map((h) => ({ id: h.id, name: h.name, card: h.card }))} />

      {drafts.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/80 p-10 text-center text-sm text-muted-foreground">
          Nenhuma partida no histórico ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {drafts.map((d) => (
            <MatchCard key={d.id} draft={d} heroes={heroes} items={items} meId={String(user.id)} />
          ))}
        </ul>
      )}
    </main>
  )
}

function MatchCard({
  draft,
  heroes,
  items,
  meId,
}: {
  draft: SavedDraft
  heroes: Map<number, Hero>
  items: Map<number, ShopItem>
  meId: string
}) {
  const played = draft.stats.some((p) => p.userId === meId)
  const mvp = draft.stats.find((p) => p.mvpRank === 1)
  const captain = (team: Team) => captainOf(draft, team)

  const summary = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="w-56 shrink-0 truncate font-display text-base font-bold uppercase tracking-wide">
        <span style={{ color: TEAM_COLORS[draft.winner] }}>{teamTitle(draft, draft.winner)}</span>{" "}
        <span className="text-foreground">venceu</span>
        {captain(draft.winner) && (
          <span className="block font-sans text-[10px] font-semibold normal-case tracking-normal text-muted-foreground">
            ({TEAM_NAMES[draft.winner]})
          </span>
        )}
      </span>
      {/* Heróis de cada time, em miniatura (o vencedor em destaque). */}
      <div className="flex items-center gap-2">
        {(["a", "b"] as const).map((team, i) => (
          <div key={team} className="flex items-center gap-0.5">
            {i === 1 && <span className="mr-1.5 text-[10px] font-bold text-muted-foreground">vs</span>}
            {draft.stats
              .filter((p) => p.team === team)
              .map((p) => {
                const h = heroes.get(p.heroId)
                return h ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.accountId}
                    src={h.card}
                    alt={h.name}
                    title={`${h.name} · ${playerName(p)}`}
                    className={`h-7 w-7 rounded border-b-2 object-cover object-top ${draft.winner === team ? "" : "opacity-50 grayscale"}`}
                    style={{ borderColor: TEAM_COLORS[team] }}
                  />
                ) : null
              })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {/* Partidas de print não têm o horário real (só depois de vincular pela API). */}
        {draft.verified && <span>{formatDateTime(draft.playedAt)}</span>}
        <span className="font-mono">{formatDuration(draft.durationS)}</span>
        {!draft.verified && <span className="rounded-full bg-yellow-600/20 px-2 py-0.5 font-semibold text-yellow-300">Pendente</span>}
        {played && <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">Você jogou</span>}
      </div>
    </div>
  )

  return (
    <Collapsible summary={summary}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        {draft.matchId && (
          <span>
            Partida <span className="font-mono">{draft.matchId}</span>
          </span>
        )}
        {mvp && <span>MVP: {playerName(mvp)}</span>}
        <span className="rounded-full bg-muted px-2 py-0.5">
          {draft.source === "draft" ? "Draft na plataforma" : draft.source === "print" ? "Lida de print" : "Importada pelo ID"}
        </span>
      </div>

      {!draft.verified && <VerifyMatchForm draftId={draft.id} matchId={draft.matchId} />}

      {draft.source === "draft" && <DraftLog draft={draft} heroes={heroes} />}

      {(["a", "b"] as const).map((team) => (
        <div key={team} className="space-y-1.5">
          <Scoreboard
            team={team}
            players={draft.stats.filter((p) => p.team === team)}
            winner={draft.winner === team}
            heroes={heroes}
            items={items}
            meId={meId}
            captain={captain(team)}
          />
        </div>
      ))}
    </Collapsible>
  )
}

// Capitão do time (primeiro jogador), só nos drafts feitos na plataforma.
function captainOf(draft: SavedDraft, team: Team) {
  return draft.source === "draft" ? draft.teams[team][0]?.name : undefined
}

// Como a Gamers Club: "Time <capitão>"; sem draft, o lado do jogo.
function teamTitle(draft: SavedDraft, team: Team) {
  const captain = captainOf(draft, team)
  return captain ? `Time ${captain}` : TEAM_NAMES[team]
}

// Tudo o que aconteceu na sala: moeda, quem escolheu quem e os bans e picks de heróis, na ordem.
function DraftLog({ draft, heroes }: { draft: SavedDraft; heroes: Map<number, Hero> }) {
  const labels = { a: teamTitle(draft, "a"), b: teamTitle(draft, "b") }
  const toView = (p: { id: string; name: string }): PlayerView => ({ id: p.id, name: p.name, avatar: null, online: true, bot: false, guest: false })
  const first = draft.playerFirst
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Draft</p>
      {first && (
        <p className="text-xs text-muted-foreground">
          Moeda: <b style={{ color: TEAM_COLORS[first] }}>{labels[first]}</b> escolheu jogador primeiro, e{" "}
          <b style={{ color: TEAM_COLORS[first === "a" ? "b" : "a"] }}>{labels[first === "a" ? "b" : "a"]}</b> começou nos heróis.
          {draft.turnSeconds && <> Tempo por turno: {draft.turnSeconds}s.</>}
        </p>
      )}
      <DraftTimeline
        playerSteps={first ? buildPlayerSteps(first) : []}
        playerPicks={draft.playerPicks.length}
        playersDone
        currentPlayerPick={false}
        teams={{ a: draft.teams.a.map(toView), b: draft.teams.b.map(toView) }}
        heroSteps={draft.steps}
        actions={draft.steps.map((s) => s.heroId)}
        currentHeroStep={null}
        heroById={heroes}
        teamLabels={labels}
      />
    </div>
  )
}
