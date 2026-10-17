import "server-only"
import { db } from "@/lib/db"
import type { ResultPlayer, Step, Team } from "@/lib/draft-rules"

export type SavedDraft = {
  id: string
  // draft: jogada pela plataforma; import: adicionada pelo ID, sem dados de draft.
  // print: lida de um print, aguardando confirmação pela API (verified = false).
  source: "draft" | "import" | "print"
  verified: boolean
  playedAt: number
  firstTeam: Team | null
  turnSeconds: number | null
  teams: Record<Team, { id: string; name: string }[]>
  steps: (Step & { heroId: number })[]
  matchId: number | null
  winner: Team
  durationS: number
  stats: ResultPlayer[]
}

type Row = {
  id: string
  source: "draft" | "import" | "print"
  verified: number
  played_at: number
  first_team: Team | null
  turn_seconds: number | null
  team_a: string
  team_b: string
  steps: string
  match_id: number | null
  winner: Team
  duration_s: number
  stats: string
}

// Todas as partidas do histórico (inclusive as pendentes, de print), da mais recente para a mais antiga.
export function listDrafts(): SavedDraft[] {
  const rows = db.prepare("SELECT * FROM drafts ORDER BY played_at DESC").all() as Row[]
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    verified: r.verified === 1,
    playedAt: r.played_at,
    firstTeam: r.first_team,
    turnSeconds: r.turn_seconds,
    teams: { a: JSON.parse(r.team_a), b: JSON.parse(r.team_b) },
    steps: JSON.parse(r.steps),
    matchId: r.match_id,
    winner: r.winner,
    durationS: r.duration_s,
    stats: JSON.parse(r.stats),
  }))
}

// Só as confirmadas pela API (as que contam no leaderboard), da mais recente para a mais antiga.
export const listVerifiedMatches = () => listDrafts().filter((m) => m.verified)
