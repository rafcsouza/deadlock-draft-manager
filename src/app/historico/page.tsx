import Link from "next/link"
import { Collapsible } from "@/components/collapsible"
import { ImportMatchForm, VerifyMatchForm } from "@/components/import-match-form"
import { Logo } from "@/components/logo"
import { Scoreboard } from "@/components/scoreboard"
import { requireUser } from "@/lib/auth"
import { TEAM_COLORS, TEAM_NAMES, type Team } from "@/lib/draft-rules"
import { listDrafts, type SavedDraft } from "@/lib/drafts"
import { formatDateTime, formatDuration, playerName } from "@/lib/format"
import { getHeroes, type Hero } from "@/lib/heroes"
import { getItems, type ShopItem } from "@/lib/items"
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
        <Link href="/" aria-label="Voltar para o início">
          <Logo className="h-6 w-6" />
        </Link>
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

  const summary = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="w-44 shrink-0 font-display text-base font-bold uppercase tracking-wide">
        <span style={{ color: TEAM_COLORS[draft.winner] }}>{TEAM_NAMES[draft.winner]}</span>{" "}
        <span className="text-foreground">venceu</span>
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

      {(["a", "b"] as const).map((team) => (
        <div key={team} className="space-y-1.5">
          <Scoreboard
            team={team}
            players={draft.stats.filter((p) => p.team === team)}
            winner={draft.winner === team}
            heroes={heroes}
            items={items}
            meId={meId}
          />
          {draft.source === "draft" && <Bans team={team} draft={draft} heroes={heroes} />}
        </div>
      ))}
    </Collapsible>
  )
}

function Bans({ team, draft, heroes }: { team: Team; draft: SavedDraft; heroes: Map<number, Hero> }) {
  const bans = draft.steps.filter((s) => s.team === team && s.action === "ban").map((s) => heroes.get(s.heroId))
  if (bans.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 px-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bans</span>
      {bans.map((h, i) =>
        h ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={h.critical} alt={`${h.name} (banido)`} title={`${h.name} (banido)`} className="h-7 w-7 rounded border border-red-600/70 object-cover object-top opacity-80" />
        ) : (
          <span key={i} className="h-7 w-7 rounded bg-muted" />
        ),
      )}
    </div>
  )
}
