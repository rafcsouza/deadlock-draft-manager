import type { Team } from "@/lib/draft-rules"

// Dados lidos de um print, editáveis na tela de revisão antes de salvar.
export type PrintPlayer = {
  name: string
  heroId: number | null
  souls: number | null
  kills: number | null
  deaths: number | null
  assists: number | null
  damage: number | null
  objDamage: number | null
  healing: number | null
}

export type PrintReview = {
  matchId: number | null
  durationS: number | null
  winner: Team | null
  teams: Record<Team, PrintPlayer[]>
}

export const PRINT_STATS = ["souls", "kills", "deaths", "assists", "damage", "objDamage", "healing"] as const
