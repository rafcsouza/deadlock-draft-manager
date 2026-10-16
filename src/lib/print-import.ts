import "server-only"
import type { ResultPlayer, Team } from "@/lib/draft-rules"
import type { Hero } from "@/lib/heroes"
import { PRINT_STATS, type PrintPlayer, type PrintReview } from "@/lib/print-types"
import { readScoreboard } from "@/lib/scoreboard-ocr"

const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

// Herói mais parecido com o texto lido (o OCR às vezes troca uma letra: "Bynamo" → Dynamo).
function matchHero(text: string, heroes: Hero[]): number | null {
  const t = normalize(text)
  if (!t) return null
  let best: { id: number; d: number } | null = null
  for (const h of heroes) {
    const d = distance(t, normalize(h.name))
    if (!best || d < best.d) best = { id: h.id, d }
  }
  return best && best.d <= Math.max(2, Math.floor(t.length / 3)) ? best.id : null
}

// Lê o print com OCR local e devolve os dados para a pessoa revisar.
export async function readPrint(file: File, heroes: Hero[]): Promise<PrintReview> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Envie uma imagem PNG, JPG ou WEBP.")
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Imagem muito grande (máximo 12 MB).")

  const board = await readScoreboard(Buffer.from(await file.arrayBuffer()))
  const players = (list: (typeof board.teams)["a"]): PrintPlayer[] =>
    list.map(({ hero, ...p }) => ({ ...p, heroId: matchHero(hero, heroes) }))

  const review = { matchId: board.matchId, durationS: board.durationS, winner: board.winner, teams: { a: players(board.teams.a), b: players(board.teams.b) } }
  if (review.teams.a.length + review.teams.b.length === 0) {
    throw new Error("Não encontrei jogadores nesse print. Ele precisa ser o placar de fim de partida, em tela cheia.")
  }
  return review
}

const int = (v: unknown, max: number) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null
}

// Valida a revisão enviada pelo navegador e converte para o formato salvo no histórico.
export function reviewToPlayers(review: PrintReview, heroes: Hero[]) {
  const heroIds = new Set(heroes.map((h) => h.id))
  if (review.winner !== "a" && review.winner !== "b") throw new Error("Escolha o time vencedor.")

  let fakeId = 0
  const players: ResultPlayer[] = []
  for (const team of ["a", "b"] as Team[]) {
    const list = review.teams?.[team] ?? []
    if (list.length === 0 || list.length > 6) throw new Error("Cada time precisa ter de 1 a 6 jogadores.")
    for (const p of list) {
      const name = String(p.name ?? "").trim().slice(0, 40)
      if (!name) throw new Error("Todo jogador precisa de um nome.")
      if (!p.heroId || !heroIds.has(Number(p.heroId))) throw new Error(`Escolha o herói de ${name}.`)
      const stats = Object.fromEntries(PRINT_STATS.map((k) => [k, int(p[k], 10_000_000)])) as Record<(typeof PRINT_STATS)[number], number | null>
      const missing = PRINT_STATS.find((k) => stats[k] === null)
      if (missing) throw new Error(`Confira os números de ${name}.`)
      players.push({
        // Sem SteamID no print: IDs negativos provisórios até vincular pela API.
        accountId: -++fakeId,
        team,
        heroId: Number(p.heroId),
        steamName: name,
        kills: stats.kills!,
        deaths: stats.deaths!,
        assists: stats.assists!,
        netWorth: stats.souls!,
        lastHits: 0,
        denies: 0,
        damage: stats.damage!,
        objDamage: stats.objDamage!,
        damageTaken: 0,
        healing: stats.healing!,
        level: 0,
        mvpRank: null,
        items: [],
        userId: null,
        name: null,
      })
    }
  }

  return {
    matchId: int(review.matchId, Number.MAX_SAFE_INTEGER) || null,
    winner: review.winner,
    durationS: int(review.durationS, 24 * 3600) ?? 0,
    players,
  }
}
