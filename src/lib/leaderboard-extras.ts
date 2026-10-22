import "server-only"
import type { LeaderboardRow } from "@/lib/leaderboard"
import { listVerifiedMatches } from "@/lib/drafts"
import { getAccountLinks } from "@/lib/players"

// Extras do leaderboard: forma recente, prêmios por estatística e duplas/fregueses.
// Tudo calculado do mesmo histórico que a pontuação (partidas confirmadas).

export type Award = {
  key: string
  icon: string
  title: string
  description: string
  accountId: number
  name: string
  heroId: number | null
  value: string
}

export type Pair = { a: { accountId: number; name: string }; b: { accountId: number; name: string }; games: number; wins: number }

export type LeaderboardExtras = {
  // Últimos resultados de cada jogador (true = vitória), do mais antigo ao mais recente.
  form: Map<number, boolean[]>
  awards: Award[]
  bestDuo: Pair | null
  worstDuo: Pair | null
  // a ganhou de b mais vezes do que perdeu (wins = vitórias de a sobre b).
  rivalry: Pair | null
}

const FORM_SIZE = 5
// Mínimo de partidas juntos (ou um contra o outro) para uma dupla contar.
const MIN_PAIR_GAMES = 3

type Totals = { matches: number; kills: number; deaths: number; damage: number; objDamage: number; souls: number; minutes: number; heroes: Set<number> }

export function getLeaderboardExtras(rows: LeaderboardRow[]): LeaderboardExtras {
  const matches = listVerifiedMatches().reverse()
  const links = getAccountLinks()
  const byId = new Map(rows.map((r) => [r.accountId, r]))
  const ranked = new Set(rows.filter((r) => !r.provisional).map((r) => r.accountId))

  const form = new Map<number, boolean[]>()
  const totals = new Map<number, Totals>()
  const together = new Map<string, { games: number; wins: number }>()
  const against = new Map<string, { games: number; wins: number }>()

  for (const m of matches) {
    const players = m.stats.map((p) => ({ ...p, id: links.main(p.accountId) }))
    for (const p of players) {
      const won = p.team === m.winner
      const f = form.get(p.id) ?? []
      f.push(won)
      form.set(p.id, f.slice(-FORM_SIZE))

      const t = totals.get(p.id) ?? { matches: 0, kills: 0, deaths: 0, damage: 0, objDamage: 0, souls: 0, minutes: 0, heroes: new Set() }
      t.matches++
      t.kills += p.kills
      t.deaths += p.deaths
      t.damage += p.damage
      t.objDamage += p.objDamage
      t.souls += p.netWorth
      t.minutes += m.durationS / 60
      t.heroes.add(p.heroId)
      totals.set(p.id, t)
    }
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const [x, y] = players[i].id < players[j].id ? [players[i], players[j]] : [players[j], players[i]]
        const key = `${x.id}:${y.id}`
        if (x.team === y.team) {
          const s = together.get(key) ?? { games: 0, wins: 0 }
          s.games++
          if (x.team === m.winner) s.wins++
          together.set(key, s)
        } else {
          // wins = vitórias do de menor id (x) sobre o outro.
          const s = against.get(key) ?? { games: 0, wins: 0 }
          s.games++
          if (x.team === m.winner) s.wins++
          against.set(key, s)
        }
      }
    }
  }

  const player = (id: number) => ({ accountId: id, name: byId.get(id)?.name ?? `Steam ${id}` })

  // Prêmios: só entre quem já tem posição na tabela.
  const candidates = [...totals].filter(([id]) => ranked.has(id))
  const awards: Award[] = []
  const award = (
    key: string,
    icon: string,
    title: string,
    description: string,
    score: (t: Totals, r: LeaderboardRow) => number,
    format: (v: number) => string,
    lowest = false,
  ) => {
    let best: { id: number; v: number } | null = null
    for (const [id, t] of candidates) {
      const v = score(t, byId.get(id)!)
      if (!Number.isFinite(v)) continue
      if (!best || (lowest ? v < best.v : v > best.v)) best = { id, v }
    }
    if (!best || (!lowest && best.v <= 0)) return
    const r = byId.get(best.id)!
    awards.push({ key, icon, title, description, ...player(best.id), heroId: r.topHero?.heroId ?? null, value: format(best.v) })
  }

  const per = (n: number, t: Totals) => n / t.matches
  award("kills", "🗡️", "Carrasco", "Mais abates por partida", (t) => per(t.kills, t), (v) => `${v.toFixed(1)} abates`)
  award("deaths", "🛡️", "Imortal", "Menos mortes por partida", (t) => per(t.deaths, t), (v) => `${v.toFixed(1)} mortes`, true)
  award("damage", "💥", "Canhão", "Mais dano em heróis por partida", (t) => per(t.damage, t), (v) => `${(v / 1000).toFixed(1)}k de dano`)
  award("souls", "💰", "Farmador", "Mais almas por minuto", (t) => t.souls / Math.max(t.minutes, 1), (v) => `${Math.round(v)} almas/min`)
  award("objectives", "🏰", "Demolidor", "Mais dano em objetivos por partida", (t) => per(t.objDamage, t), (v) => `${(v / 1000).toFixed(1)}k em objetivos`)
  award("mvps", "⭐", "Craque", "Mais vezes MVP", (_, r) => r.mvps, (v) => `${v} ${v === 1 ? "MVP" : "MVPs"}`)
  award("streak", "🔥", "Imparável", "Maior sequência de vitórias", (_, r) => r.bestStreak, (v) => `${v} seguidas`)
  award("heroes", "🎭", "Camaleão", "Mais heróis diferentes", (t) => t.heroes.size, (v) => `${v} heróis`)

  // Duplas e fregueses entre quem tem posição na tabela.
  const pairs = (map: Map<string, { games: number; wins: number }>) =>
    [...map]
      .map(([key, s]) => {
        const [x, y] = key.split(":").map(Number)
        return { x, y, ...s }
      })
      .filter((p) => p.games >= MIN_PAIR_GAMES && ranked.has(p.x) && ranked.has(p.y))

  const duoRate = (p: { games: number; wins: number }) => p.wins / p.games
  const duos = pairs(together).sort((a, b) => duoRate(b) - duoRate(a) || b.games - a.games)
  const toPair = (p: { x: number; y: number; games: number; wins: number }): Pair => ({ a: player(p.x), b: player(p.y), games: p.games, wins: p.wins })
  const best = duos[0]
  const worst = [...duos].sort((a, b) => duoRate(a) - duoRate(b) || b.games - a.games)[0]

  // Freguês: o confronto mais desequilibrado (vira para o lado de quem mais ganhou).
  const rivals = pairs(against)
    .map((p) => (p.wins * 2 >= p.games ? p : { x: p.y, y: p.x, games: p.games, wins: p.games - p.wins }))
    .filter((p) => p.wins * 2 > p.games)
    .sort((a, b) => duoRate(b) - duoRate(a) || b.games - a.games)

  return {
    form,
    awards,
    bestDuo: best && duoRate(best) > 0.5 ? toPair(best) : null,
    worstDuo: worst && worst !== best && duoRate(worst) < 0.5 ? toPair(worst) : null,
    rivalry: rivals[0] ? toPair(rivals[0]) : null,
  }
}
