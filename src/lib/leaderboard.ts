import "server-only"
import { listVerifiedMatches, type SavedDraft } from "@/lib/drafts"
import { getAccountLinks, getPlayerNames, getProfilesBySteam } from "@/lib/players"

// Pontuação (recalculada do histórico inteiro, em ordem cronológica). Todo mundo começa com 0
// e ninguém perde pontos: só a vitória e o desempenho valem. Derrota não dá nada, a não ser para
// quem ficou entre os 3 melhores da partida (o bônus de MVP vale nos dois times).
export const POINTS = {
  win: 5,
  loss: 0,
  // Vitória na sequência: a 2ª seguida vale 6, da 3ª em diante vale 7.
  winStreak2: 6,
  winStreak3: 7,
  // Bônus pela colocação entre os 3 melhores da partida (a API marca só o top 3).
  mvpBonus: { 1: 4, 2: 3, 3: 2 } as Record<number, number>,
}

// Elo (modo alternativo do leaderboard): não cresce com o número de partidas. Todo mundo começa com
// ELO.start; a cada partida ganha ou perde ELO.k × (resultado − chance de vitória), com a chance
// calculada pela média de Elo de cada time. Os 3 melhores da partida ganham um bônus pequeno, mesmo
// perdendo, para o desempenho individual também contar.
export const ELO = {
  start: 1000,
  k: 32,
  // Com menos partidas, o Elo ainda está "em calibração": é calculado, mas não aparece nem conta no
  // ranking por Elo (evita que poucas partidas joguem alguém lá em cima ou lá embaixo).
  minMatches: 8,
  mvpBonus: { 1: 6, 2: 4, 3: 2 } as Record<number, number>,
}

export type LeaderboardMode = "pontos" | "elo"

// Patente do Deadlock para um Elo: começa em Mystic 1 com ELO.start, cada patente vale 40 pontos
// (6 subníveis), de Initiate a Eternus.
const RANK_NAMES = ["Initiate", "Seeker", "Acolyte", "Sentinel", "Mystic", "Ritualist", "Emissary", "Oracle", "Phantom", "Ascendant", "Eternus"]
const RANK_COLORS = ["#a0673d", "#c2477f", "#7d8fd1", "#8fbf5f", "#e7b43c", "#f06a70", "#c49af0", "#c27756", "#a9a9a9", "#d9b26a", "#5ce9a9"]
const RANK_SIZE = 40
const START_TIER = 5

export function eloRank(elo: number) {
  const steps = Math.floor(((elo - ELO.start) * 6) / RANK_SIZE)
  const index = Math.min(10 * 6 + 5, Math.max(0, (START_TIER - 1) * 6 + steps))
  const tier = Math.floor(index / 6) + 1
  const sub = (index % 6) + 1
  return {
    tier,
    sub,
    name: `${RANK_NAMES[tier - 1]} ${sub}`,
    color: RANK_COLORS[tier - 1],
    image: `https://api.deadlock-api.com/v1/assets/ranks/${tier}/${sub}/image?format=webp`,
  }
}

// Com menos partidas que isso, o jogador fica "em avaliação": aparece no fim, sem posição.
export const MIN_MATCHES = 3

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
  elo: number
  // Quanto o Elo mudou na última partida (positivo ou negativo).
  eloChange: number
  eloCalibrating: boolean
  // Pontos ganhos/perdidos em cada partida, em ordem cronológica.
  history: { draftId: string; change: number; rating: number }[]
  // Partidas por herói (heroId -> partidas).
  heroes: Map<number, number>
  // Herói mais jogado (empate: o jogado mais recentemente).
  topHero: { heroId: number; matches: number } | null
  provisional: boolean
  // Posição na tabela (null em avaliação) e quanto subiu (+) ou caiu (-) desde a partida anterior.
  // rankChange null: não tinha posição antes da última partida.
  rank: number | null
  rankChange: number | null
}

export function getLeaderboard(mode: LeaderboardMode = "pontos"): LeaderboardRow[] {
  // Partidas de print ainda não confirmadas pela API não contam (os jogadores não têm SteamID).
  const matches = listVerifiedMatches().reverse()
  const links = getAccountLinks()
  const rows = aggregate(matches, links)

  // Setas: compara com a tabela de antes da última partida.
  const before = new Map(
    rank(aggregate(matches.slice(0, -1), links), mode).map((r) => [r.accountId, r.rank]),
  )

  // Quem tem perfil aparece com o nome do perfil (de qualquer uma das suas contas).
  for (const [steamId, u] of getProfilesBySteam()) {
    const r = rows.get(links.main(steamId))
    if (r) {
      r.name = u.username
      r.hasProfile = true
      r.userId = String(u.id)
    }
  }

  // Nome fixo definido para o jogador vale acima de tudo.
  for (const [accountId, name] of getPlayerNames()) {
    const r = rows.get(links.main(accountId))
    if (r) r.name = name
  }

  return rank(rows, mode).map((r) => {
    const prev = before.get(r.accountId)
    return { ...r, rankChange: r.rank !== null && prev != null ? prev - r.rank : null }
  })
}

// Soma as partidas (em ordem cronológica) por pessoa.
function aggregate(matches: SavedDraft[], links: ReturnType<typeof getAccountLinks>): Map<number, LeaderboardRow> {
  const rows = new Map<number, LeaderboardRow>()

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
        elo: ELO.start,
        eloChange: 0,
        eloCalibrating: true,
        history: [],
        heroes: new Map(),
        topHero: null,
        provisional: true,
        rank: null,
        rankChange: null,
      }
      rows.set(accountId, r)
    }
    // Nome mais recente da Steam, de preferência o da conta principal.
    if (steamName && (playedAccount === accountId || r.name.startsWith("Steam "))) r.name = steamName
    return r
  }

  for (const match of matches) {
    const players = match.stats.map((p) => ({ p, r: row(p.accountId, p.steamName) }))
    // Chance de vitória do time A pela média de Elo antes da partida.
    const average = (team: string) => {
      const list = players.filter((x) => x.p.team === team)
      return list.reduce((sum, x) => sum + x.r.elo, 0) / Math.max(list.length, 1)
    }
    const chanceA = 1 / (1 + 10 ** ((average("b") - average("a")) / 400))
    const eloChanges = players.map(({ p }) => {
      const chance = p.team === "a" ? chanceA : 1 - chanceA
      return ELO.k * ((p.team === match.winner ? 1 : 0) - chance) + (ELO.mvpBonus[p.mvpRank ?? 0] ?? 0)
    })

    for (const [i, { p, r }] of players.entries()) {
      r.elo += eloChanges[i]
      r.eloChange = eloChanges[i]
      const won = p.team === match.winner
      // Sequência de vitórias antes desta partida (0 se a última foi derrota).
      const streakBefore = Math.max(r.streak, 0)
      let change = won ? (streakBefore >= 2 ? POINTS.winStreak3 : streakBefore === 1 ? POINTS.winStreak2 : POINTS.win) : POINTS.loss
      change += POINTS.mvpBonus[p.mvpRank ?? 0] ?? 0

      r.rating += change
      r.lastChange = change
      r.history.push({ draftId: match.id, change: Math.round(change), rating: Math.round(r.rating) })
      r.matches++
      const heroGames = (r.heroes.get(p.heroId) ?? 0) + 1
      r.heroes.set(p.heroId, heroGames)
      if (!r.topHero || heroGames >= r.topHero.matches) r.topHero = { heroId: p.heroId, matches: heroGames }
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

  return rows
}

// Ordena: primeiro quem já tem MIN_MATCHES partidas (com posição), depois quem está em avaliação.
function rank(rows: Map<number, LeaderboardRow>, mode: LeaderboardMode): LeaderboardRow[] {
  const sorted = [...rows.values()]
    .map((r) => ({
      ...r,
      rating: Math.round(r.rating),
      lastChange: Math.round(r.lastChange),
      elo: Math.round(r.elo),
      eloChange: Math.round(r.eloChange),
      provisional: r.matches < MIN_MATCHES,
      eloCalibrating: r.matches < ELO.minMatches,
    }))
    // Desempate: mais vitórias, depois melhor KDA.
    .sort(
      (a, b) =>
        Number(a.provisional) - Number(b.provisional) ||
        (mode === "elo"
          ? Number(a.eloCalibrating) - Number(b.eloCalibrating) ||
            // Em calibração o Elo ainda é escondido: vem antes quem está mais perto de calibrar.
            (a.eloCalibrating ? b.matches - a.matches : b.elo - a.elo)
          : b.rating - a.rating) ||
        b.wins - a.wins ||
        (b.kills + b.assists) / Math.max(b.deaths, 1) - (a.kills + a.assists) / Math.max(a.deaths, 1),
    )
  let position = 0
  // No ranking por Elo, quem está em calibração fica no fim, sem posição.
  return sorted.map((r) => ({ ...r, rank: r.provisional || (mode === "elo" && r.eloCalibrating) ? null : ++position }))
}
