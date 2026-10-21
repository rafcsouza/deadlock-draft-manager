import "server-only"
import { ingestNow } from "@/lib/local-ingest"

const API = "https://api.deadlock-api.com/v1"

// Modo de jogo na API: 1 = partida padrão 6v6. Outros (ex.: 4 = Street Brawl) não entram no histórico por enquanto.
const STANDARD_GAME_MODE = 1

// Chave opcional da API do Deadlock (DEADLOCK_API_KEY no .env.local): aumenta o limite de
// partidas buscadas na Steam (de 3 para 300 por hora) e dá prioridade quando a API está cheia.
const headers = (): HeadersInit => (process.env.DEADLOCK_API_KEY ? { "X-API-KEY": process.env.DEADLOCK_API_KEY } : {})

// Stats de um jogador numa partida, já no formato que guardamos.
export type PlayerStats = {
  accountId: number
  apiTeam: 0 | 1
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
  // Build final: itens que a pessoa tinha no fim (não vendidos), na ordem de compra.
  // Inclui só itens da loja (filtrados na hora de mostrar pelo catálogo de itens).
  items: number[]
}

export type MatchStats = {
  matchId: number
  winningApiTeam: 0 | 1
  durationS: number
  startTime: number
  players: PlayerStats[]
}

type ApiPlayer = {
  account_id: number
  team: number
  hero_id: number
  kills?: number
  deaths?: number
  assists?: number
  net_worth?: number
  last_hits?: number
  denies?: number
  level?: number
  mvp_rank?: number
  items?: { item_id: number; game_time_s: number; sold_time_s: number }[]
  stats?: { player_damage?: number; boss_damage?: number; player_healing?: number; player_damage_taken?: number }[]
}

type ApiMatch = {
  match_info?: {
    match_id: number
    winning_team: number
    duration_s: number
    start_time: number
    game_mode?: number
    players: ApiPlayer[]
  }
}

// Erro de limite (429) ou Steam ocupada (503): traz quanto tempo esperar antes de tentar de novo.
export class RateLimitError extends Error {
  constructor(message: string, readonly retryAfterMs: number | null) {
    super(message)
  }
}

async function request(url: string) {
  const res = await fetch(url, { cache: "no-store", headers: headers(), signal: AbortSignal.timeout(20000) })
  if (res.status === 404) return null
  if (res.status === 429 || res.status === 503) {
    const wait = Number(res.headers.get("retry-after"))
    const when = wait > 0 ? ` Tente de novo em ${Math.ceil(wait / 60)} min.` : " Tente de novo mais tarde."
    throw new RateLimitError(
      res.status === 429
        ? `Limite de partidas novas buscadas na Steam atingido (sem chave da API são 3 por hora).${when}`
        : `A Steam está ocupada e a API do Deadlock não conseguiu buscar a partida agora.${when}`,
      wait > 0 ? wait * 1000 : null,
    )
  }
  if (!res.ok) throw new Error("A API do Deadlock não respondeu. Tente de novo em instantes.")
  return (await res.json()) as ApiMatch
}

// Nomes atuais na Steam (melhor esforço: se falhar, fica sem nome).
async function fetchSteamNames(accountIds: number[]) {
  try {
    const query = accountIds.map((id) => `account_ids=${id}`).join("&")
    const res = await fetch(`${API}/players/steam?${query}`, {
      cache: "no-store",
      headers: headers(),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return new Map<number, string>()
    const rows = (await res.json()) as { account_id: number; personaname?: string }[]
    return new Map(rows.filter((r) => r.personaname).map((r) => [r.account_id, r.personaname as string]))
  } catch {
    return new Map<number, string>()
  }
}

type MatchInfo = NonNullable<ApiMatch["match_info"]>

// Tenta como partida normal e depois como lobby personalizado. null: a API não tem a partida.
async function fetchInfo(matchId: number): Promise<MatchInfo | null> {
  const data =
    (await request(`${API}/matches/${matchId}/metadata`)) ??
    (await request(`${API}/matches/${matchId}/metadata?is_custom=true`))
  return data?.match_info?.players?.length ? data.match_info : null
}

// Busca a partida pelo ID.
export async function fetchMatchStats(matchId: number): Promise<MatchStats> {
  let info: MatchInfo | null = null
  let limited: RateLimitError | null = null
  try {
    info = await fetchInfo(matchId)
  } catch (e) {
    if (!(e instanceof RateLimitError)) throw e
    limited = e
  }
  // A API ainda não tem os dados da partida (ou teria de pedir à Steam, que limita): o ingest deste PC
  // manda agora o que o jogo e o cache da Steam têm, e tentamos mais uma vez.
  if (!info && (await ingestNow())) {
    limited = null
    info = await fetchInfo(matchId)
  }
  if (limited) throw limited
  if (!info) {
    throw new Error("Partida não encontrada. Confira o ID; partidas muito recentes podem levar alguns minutos para aparecer.")
  }
  if (info.game_mode !== undefined && info.game_mode !== STANDARD_GAME_MODE) {
    throw new Error("Essa partida não é do modo padrão 6v6 (ex.: Street Brawl). Por enquanto o histórico aceita só partidas 6v6.")
  }

  const names = await fetchSteamNames(info.players.map((p) => p.account_id))

  return {
    matchId: info.match_id,
    winningApiTeam: info.winning_team === 1 ? 1 : 0,
    durationS: info.duration_s,
    startTime: info.start_time * 1000,
    players: info.players.map((p) => {
      const last = p.stats?.at(-1)
      return {
        accountId: p.account_id,
        apiTeam: p.team === 1 ? 1 : 0,
        heroId: p.hero_id,
        steamName: names.get(p.account_id) ?? null,
        kills: p.kills ?? 0,
        deaths: p.deaths ?? 0,
        assists: p.assists ?? 0,
        netWorth: p.net_worth ?? 0,
        lastHits: p.last_hits ?? 0,
        denies: p.denies ?? 0,
        damage: last?.player_damage ?? 0,
        objDamage: last?.boss_damage ?? 0,
        damageTaken: last?.player_damage_taken ?? 0,
        healing: last?.player_healing ?? 0,
        level: p.level ?? 0,
        mvpRank: p.mvp_rank ?? null,
        items: (p.items ?? [])
          .filter((i) => !i.sold_time_s)
          .sort((a, b) => a.game_time_s - b.game_time_s)
          .map((i) => i.item_id),
      }
    }),
  }
}
