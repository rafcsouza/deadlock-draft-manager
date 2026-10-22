// Regras e tipos do draft compartilhados entre o servidor (sala) e a tela.

export type Team = "a" | "b"
export type Step = { team: Team; action: "ban" | "pick" }

export const TEAM_NAMES: Record<Team, string> = { a: "Hidden King", b: "Archmother" }
export const TEAM_COLORS: Record<Team, string> = { a: "var(--team-a)", b: "var(--team-b)" }
export const TEAM_SIZE = 6

// Tempo por turno (pick ou ban), em segundos.
export const TURN_MIN = 30
export const TURN_MAX = 180
export const TURN_STEP = 5

// Animação do cara ou coroa: giro + tempo mostrando o resultado antes do 1º turno.
export const COIN_SPIN_MS = 1600
export const COIN_TOTAL_MS = 2800

export const ROOM_CODE_PATTERN = /^[a-f0-9]{8}$/

// Formato padrão: "a#" = ban do time A, "b2" = 2 picks do time B, etc.
// Escrito com o time A começando; buildSteps inverte se o time B vencer a moeda.
const ORDER = "a#-b#-a1-b2-a2-b1-b#-a#-b1-a2-b2-a1"

const BASE_STEPS: Step[] = ORDER.split("-").flatMap((turn): Step[] => {
  const team = turn[0] as Team
  if (turn[1] === "#") return [{ team, action: "ban" }]
  return Array.from({ length: Number(turn.slice(1)) }, () => ({ team, action: "pick" }))
})

export const TOTAL_STEPS = BASE_STEPS.length

export function buildSteps(first: Team | null): Step[] {
  if (first !== "b") return BASE_STEPS
  return BASE_STEPS.map((s) => ({ ...s, team: s.team === "a" ? "b" : "a" }))
}

// Escolha de jogadores pelos capitães (formato "snake"): quem ganhou a moeda escolhe 1,
// o outro 2, e assim por diante, até os dois times terem 5 jogadores além do capitão.
// Escrito com o time A começando; buildPlayerSteps inverte se o time B vencer a moeda.
const PLAYER_ORDER = [1, 2, 2, 2, 2, 1]

export function buildPlayerSteps(first: Team): Team[] {
  const other: Team = first === "a" ? "b" : "a"
  return PLAYER_ORDER.flatMap((n, i) => Array<Team>(n).fill(i % 2 === 0 ? first : other))
}

export const slotsFor = (team: Team, action: Step["action"]) =>
  BASE_STEPS.filter((s) => s.team === team && s.action === action).length

// ---------- Estado da sala visto por um jogador ----------

// bot: jogador fictício, controlado pelo anfitrião (para testes).
// guest: entrou como visitante, sem conta.
export type PlayerView = { id: string; name: string; avatar: string | null; online: boolean; bot: boolean; guest: boolean }

export type ChatMessage = { id: string; authorId: string; author: string; text: string; at: number }

// Stats de um jogador na partida, já com o time do draft e o perfil (se o SteamID bater).
export type ResultPlayer = {
  accountId: number
  team: Team
  heroId: number
  steamName: string | null
  kills: number
  deaths: number
  assists: number
  netWorth: number
  lastHits: number
  denies: number
  damage: number
  objDamage: number
  damageTaken: number
  healing: number
  level: number
  mvpRank: number | null
  items: number[]
  userId: string | null
  name: string | null
}

export type MatchResultView = {
  matchId: number
  winner: Team
  durationS: number
  startTime: number
  players: ResultPlayer[]
  // Quantos heróis da partida batem com os picks do draft (de 12).
  heroMatches: number
}

export type RoomView = {
  code: string
  serverNow: number
  hostId: string | null
  // Dono da sala (quem entrou primeiro).
  host: PlayerView | null
  lobby: PlayerView[]
  teams: Record<Team, PlayerView[]>
  // Fases: capitães (playerFirst null) → escolha de jogadores → heróis (first definido).
  // playerFirst: time que ganhou a moeda e escolhe jogador primeiro; o outro começa nos heróis.
  playerFirst: Team | null
  playerPicks: number
  // Último jogador escolhido pelos capitães, enquanto ainda dá para desfazer (antes do primeiro herói).
  lastPick: string | null
  playersDone: boolean
  first: Team | null
  coinAt: number | null
  actions: number[]
  turnSeconds: number
  deadline: number | null
  chat: { geral: ChatMessage[]; time: ChatMessage[] }
  // Depois do draft: resultado buscado pelo ID da partida, aguardando confirmação.
  result: MatchResultView | null
  fetchingResult: boolean
  savedDraftId: string | null
}

export type RoomAction =
  | { type: "move"; playerId: string; to: Team | "lobby" }
  | { type: "randomizeCaptains" }
  | { type: "startDraft" }
  | { type: "pickPlayer"; playerId: string }
  | { type: "undoPick" }
  | { type: "endPlayerPicks" }
  | { type: "choose"; heroId: number }
  | { type: "turnSeconds"; seconds: number }
  | { type: "restart" }
  | { type: "chat"; channel: "geral" | "time"; text: string }
  | { type: "addBot" }
  | { type: "submitMatch"; matchId: string }
  | { type: "confirmResult" }
  | { type: "discardResult" }
