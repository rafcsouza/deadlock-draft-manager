import "server-only"
import { db } from "@/lib/db"
import { listDrafts } from "@/lib/drafts"
import { getAccountLinks, getPlayerNames } from "@/lib/players"

// Pontuação (recalculada do histórico inteiro, em ordem cronológica). Todo mundo começa com 0
// e só ganha pontos: vitória vale mais, derrota vale menos, e há bônus por sequência e MVP.
export const POINTS = {
  win: 5,
  loss: 3,
  // Vitória na sequência: a 2ª seguida vale 6, da 3ª em diante vale 7.
  winStreak2: 6,
  winStreak3: 7,
  // Bônus pela colocação de MVP da partida (vale também na derrota).
  mvpBonus: { 1: 2, 2: 1 } as Record<number, number>,
}

export type LeaderboardRow = {
  accountId: number
  name: string
  hasProfile: boolean
  userId: string | null
  // Contas Steam da pessoa (mais de uma quando ela joga em contas diferentes); accountId é a principal.
  accounts: number[]
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
  // Pontos ganhos/perdidos em cada partida, em ordem cronológica.
  history: { draftId: string; change: number; rating: number }[]
}

export function getLeaderboard(): LeaderboardRow[] {
  // Partidas de print ainda não confirmadas pela API não contam (os jogadores não têm SteamID).
  const matches = listDrafts(100000)
    .filter((m) => m.verified)
    .sort((a, b) => a.playedAt - b.playedAt)
  const rows = new Map<number, LeaderboardRow>()
  const links = getAccountLinks()

  // Contas ligadas somam na conta principal da pessoa.
  const row = (playedAccount: number, steamName: string | null) => {
    const accountId = links.main(playedAccount)
    let r = rows.get(accountId)
    if (!r) {
      r = {
        accountId,
        name: steamName ?? `Steam ${accountId}`,
        hasProfile: false,
        userId: null,
        accounts: links.accounts(accountId),
        rating: 0,
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
        history: [],
      }
      rows.set(accountId, r)
    }
    // Nome mais recente da Steam, de preferência o da conta principal.
    if (steamName && (playedAccount === accountId || r.name.startsWith("Steam "))) r.name = steamName
    return r
  }

  for (const match of matches) {
    for (const p of match.stats) {
      const r = row(p.accountId, p.steamName)
      const won = p.team === match.winner
      // Sequência de vitórias antes desta partida (0 se a última foi derrota).
      const streakBefore = Math.max(r.streak, 0)
      let change = won ? (streakBefore >= 2 ? POINTS.winStreak3 : streakBefore === 1 ? POINTS.winStreak2 : POINTS.win) : POINTS.loss
      change += POINTS.mvpBonus[p.mvpRank ?? 0] ?? 0

      r.rating += change
      r.lastChange = change
      r.history.push({ draftId: match.id, change: Math.round(change), rating: Math.round(r.rating) })
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

  // Quem tem perfil aparece com o nome do perfil (de qualquer uma das suas contas).
  const ids = [...rows.values()].flatMap((r) => r.accounts)
  if (ids.length) {
    const profiles = db
      .prepare(`SELECT id, username, steam_account_id FROM users WHERE steam_account_id IN (${ids.map(() => "?").join(",")})`)
      .all(...ids) as { id: number; username: string; steam_account_id: number }[]
    for (const u of profiles) {
      const r = rows.get(links.main(u.steam_account_id))
      if (r) {
        r.name = u.username
        r.hasProfile = true
        r.userId = String(u.id)
      }
    }
  }

  // Nome fixo definido para o jogador vale acima de tudo.
  for (const [accountId, name] of getPlayerNames()) {
    const r = rows.get(links.main(accountId))
    if (r) r.name = name
  }

  return [...rows.values()]
    .map((r) => ({ ...r, rating: Math.round(r.rating), lastChange: Math.round(r.lastChange) }))
    // Desempate: mais vitórias, depois melhor KDA.
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.wins - a.wins ||
        (b.kills + b.assists) / Math.max(b.deaths, 1) - (a.kills + a.assists) / Math.max(a.deaths, 1),
    )
}
