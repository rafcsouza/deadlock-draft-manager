import "server-only"
import { db } from "@/lib/db"
import type { Team } from "@/lib/draft-rules"
import { listDrafts } from "@/lib/drafts"

// Pontuação (recalculada do histórico inteiro, em ordem cronológica):
// - Elo por time: compara a média de pontos dos dois times. Ganho/perda de até K pontos.
// - Bônus de MVP (mesmo na derrota): 1º +6, 2º +4, 3º +2.
// - Bônus de sequência: na vitória, +2 por vitória seguida anterior (máx. +8).
export const RATING = {
  start: 1000,
  k: 32,
  kProvisional: 48,
  provisionalMatches: 5,
  mvpBonus: { 1: 6, 2: 4, 3: 2 } as Record<number, number>,
  streakBonusPerWin: 2,
  streakBonusMax: 8,
}

export type LeaderboardRow = {
  accountId: number
  name: string
  hasProfile: boolean
  userId: string | null
  rating: number
  matches: number
  wins: number
  losses: number
  mvps: number
  streak: number // positivo: vitórias seguidas; negativo: derrotas seguidas
  bestStreak: number
  kills: number
  deaths: number
  assists: number
  lastChange: number
}

export function getLeaderboard(): LeaderboardRow[] {
  // Partidas de print ainda não confirmadas pela API não contam (os jogadores não têm SteamID).
  const matches = listDrafts(100000)
    .filter((m) => m.verified)
    .sort((a, b) => a.playedAt - b.playedAt)
  const rows = new Map<number, LeaderboardRow>()

  const row = (accountId: number, steamName: string | null) => {
    let r = rows.get(accountId)
    if (!r) {
      r = {
        accountId,
        name: steamName ?? `Steam ${accountId}`,
        hasProfile: false,
        userId: null,
        rating: RATING.start,
        matches: 0,
        wins: 0,
        losses: 0,
        mvps: 0,
        streak: 0,
        bestStreak: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        lastChange: 0,
      }
      rows.set(accountId, r)
    }
    if (steamName) r.name = steamName // nome mais recente da Steam
    return r
  }

  for (const match of matches) {
    const players = match.stats.map((p) => ({ p, r: row(p.accountId, p.steamName) }))
    const avg = (team: Team) => {
      const list = players.filter((x) => x.p.team === team)
      return list.reduce((s, x) => s + x.r.rating, 0) / Math.max(list.length, 1)
    }
    const teamRating = { a: avg("a"), b: avg("b") }

    for (const { p, r } of players) {
      const won = p.team === match.winner
      const other = p.team === "a" ? "b" : "a"
      const expected = 1 / (1 + 10 ** ((teamRating[other] - teamRating[p.team]) / 400))
      const k = r.matches < RATING.provisionalMatches ? RATING.kProvisional : RATING.k
      let change = k * ((won ? 1 : 0) - expected)
      change += RATING.mvpBonus[p.mvpRank ?? 0] ?? 0
      if (won && r.streak > 0) change += Math.min(r.streak * RATING.streakBonusPerWin, RATING.streakBonusMax)

      r.rating += change
      r.lastChange = change
      r.matches++
      r.kills += p.kills
      r.deaths += p.deaths
      r.assists += p.assists
      if (p.mvpRank === 1) r.mvps++
      if (won) {
        r.wins++
        r.streak = r.streak > 0 ? r.streak + 1 : 1
        r.bestStreak = Math.max(r.bestStreak, r.streak)
      } else {
        r.losses++
        r.streak = r.streak < 0 ? r.streak - 1 : -1
      }
    }
  }

  // Quem tem perfil aparece com o nome do perfil.
  const ids = [...rows.keys()]
  if (ids.length) {
    const profiles = db
      .prepare(`SELECT id, username, steam_account_id FROM users WHERE steam_account_id IN (${ids.map(() => "?").join(",")})`)
      .all(...ids) as { id: number; username: string; steam_account_id: number }[]
    for (const u of profiles) {
      const r = rows.get(u.steam_account_id)
      if (r) {
        r.name = u.username
        r.hasProfile = true
        r.userId = String(u.id)
      }
    }
  }

  return [...rows.values()]
    .map((r) => ({ ...r, rating: Math.round(r.rating), lastChange: Math.round(r.lastChange) }))
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
}
