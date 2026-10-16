import "server-only"
import { randomBytes } from "node:crypto"
import { db } from "@/lib/db"
import type { MatchResultView, ResultPlayer, Step, Team } from "@/lib/draft-rules"
import { fetchMatchStats, type MatchStats } from "@/lib/match-stats"

// Partidas no histórico: de um draft da plataforma, importadas pelo ID ou lidas de um print.

// Converte os stats da API para o formato salvo, ligando cada jogador ao perfil pelo SteamID.
// teamFor diz qual time do site (a = Hidden King, b = Archmother) é cada time da API.
export function toResult(stats: MatchStats, teamFor: (apiTeam: 0 | 1) => Team, heroMatches: number): MatchResultView {
  const ids = stats.players.map((p) => p.accountId)
  const profiles = new Map(
    (
      db
        .prepare(`SELECT id, username, steam_account_id FROM users WHERE steam_account_id IN (${ids.map(() => "?").join(",")})`)
        .all(...ids) as { id: number; username: string; steam_account_id: number }[]
    ).map((u) => [u.steam_account_id, u]),
  )

  const players: ResultPlayer[] = stats.players.map(({ apiTeam, ...p }) => {
    const user = profiles.get(p.accountId)
    return { ...p, team: teamFor(apiTeam), userId: user ? String(user.id) : null, name: user?.username ?? null }
  })

  return {
    matchId: stats.matchId,
    winner: teamFor(stats.winningApiTeam),
    durationS: stats.durationS,
    startTime: stats.startTime,
    players,
    heroMatches,
  }
}

export const matchExists = (matchId: number, exceptId?: string) =>
  Boolean(db.prepare("SELECT 1 FROM drafts WHERE match_id = ? AND id IS NOT ?").get(matchId, exceptId ?? null))

type DraftInfo = {
  roomCode: string
  firstTeam: Team
  turnSeconds: number
  teams: Record<Team, { id: string; name: string }[]>
  steps: (Step & { heroId: number })[]
}

export function saveMatch(result: MatchResultView, draft: DraftInfo | null) {
  const id = randomBytes(5).toString("hex")
  db.prepare(
    `INSERT INTO drafts (id, source, room_code, finished_at, played_at, first_team, turn_seconds, team_a, team_b, steps, match_id, winner, duration_s, stats)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    draft ? "draft" : "import",
    draft?.roomCode ?? null,
    Date.now(),
    result.startTime || Date.now(),
    draft?.firstTeam ?? null,
    draft?.turnSeconds ?? null,
    JSON.stringify(draft?.teams.a ?? []),
    JSON.stringify(draft?.teams.b ?? []),
    JSON.stringify(draft?.steps ?? []),
    result.matchId,
    result.winner,
    result.durationS,
    JSON.stringify(result.players),
  )
  return id
}

// Importa uma partida que já aconteceu (fora da plataforma) direto para o histórico.
// Sem draft, o time 0 da API é o Hidden King e o time 1, a Archmother (como no jogo).
export async function importMatch(matchId: number) {
  if (matchExists(matchId)) throw new Error("Essa partida já está no histórico.")
  const stats = await fetchMatchStats(matchId)
  if (matchExists(stats.matchId)) throw new Error("Essa partida já está no histórico.")
  const result = toResult(stats, (t) => (t === 0 ? "a" : "b"), 0)
  return saveMatch(result, null)
}

// Salva uma partida lida de um print: fica no histórico como pendente (fora do leaderboard)
// até ser vinculada pela API, que traz os SteamIDs, itens e o MVP.
export function savePrintMatch(result: { matchId: number | null; winner: Team; durationS: number; players: ResultPlayer[] }) {
  if (result.matchId && matchExists(result.matchId)) throw new Error("Essa partida já está no histórico.")
  const id = randomBytes(5).toString("hex")
  db.prepare(
    `INSERT INTO drafts (id, source, verified, finished_at, played_at, team_a, team_b, steps, match_id, winner, duration_s, stats)
     VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, "print", Date.now(), Date.now(), "[]", "[]", "[]", result.matchId, result.winner, result.durationS, JSON.stringify(result.players))
  return id
}

// Confirma uma partida pendente (de print) com os dados da API, pelo ID da partida.
// Confere se os heróis batem com o print, para não vincular a partida errada.
export async function verifyMatch(draftId: string, matchId: number) {
  const row = db.prepare("SELECT stats, verified FROM drafts WHERE id = ?").get(draftId) as
    | { stats: string; verified: number }
    | undefined
  if (!row) throw new Error("Partida não encontrada no histórico.")
  if (row.verified) throw new Error("Essa partida já foi confirmada.")
  if (matchExists(matchId, draftId)) throw new Error("Esse ID já está ligado a outra partida do histórico.")

  const stats = await fetchMatchStats(matchId)
  const printHeroes = (JSON.parse(row.stats) as ResultPlayer[]).map((p) => `${p.team}:${p.heroId}`)
  const result = toResult(stats, (t) => (t === 0 ? "a" : "b"), 0)
  const apiHeroes = new Set(result.players.map((p) => `${p.team}:${p.heroId}`))
  const matches = printHeroes.filter((h) => apiHeroes.has(h)).length
  if (matches < Math.min(10, printHeroes.length)) {
    throw new Error(`Só ${matches} de ${printHeroes.length} heróis dessa partida batem com o print. Confira o ID.`)
  }

  db.prepare(
    `UPDATE drafts SET verified = 1, match_id = ?, winner = ?, duration_s = ?, played_at = ?, stats = ? WHERE id = ?`,
  ).run(result.matchId, result.winner, result.durationS, result.startTime || Date.now(), JSON.stringify(result.players), draftId)
}
