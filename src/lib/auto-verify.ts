import "server-only"
import { db } from "@/lib/db"
import { verifyMatch } from "@/lib/match-results"
import { RateLimitError } from "@/lib/match-stats"

// Vincula sozinho, em segundo plano, as partidas pendentes (lidas de print) pela API do Deadlock.
// Uma tentativa por vez, espaçadas para caber no limite de 3 buscas por hora na Steam;
// quando a API manda esperar (Retry-After), espera exatamente esse tempo.

const INTERVAL_MS = 21 * 60 * 1000 // ~3 por hora
const MIN_WAIT_MS = 60 * 1000
const STARTUP_DELAY_MS = 30 * 1000

const g = globalThis as unknown as { autoVerify?: { timer: ReturnType<typeof setTimeout> | null; failures: Map<string, number> } }

const log = (msg: string) => console.log(`[auto-vincular ${new Date().toLocaleString("pt-BR")}] ${msg}`)

type Pending = { id: string; match_id: number }

// A partida pendente que está há mais tempo sem tentativa (cada partida com erro vai para o fim da fila).
function nextPending(failures: Map<string, number>): Pending | null {
  const rows = db
    .prepare("SELECT id, match_id FROM drafts WHERE verified = 0 AND match_id IS NOT NULL ORDER BY played_at DESC")
    .all() as Pending[]
  rows.sort((a, b) => (failures.get(a.id) ?? 0) - (failures.get(b.id) ?? 0))
  return rows[0] ?? null
}

async function tick() {
  const state = g.autoVerify!
  let wait = INTERVAL_MS
  try {
    const pending = nextPending(state.failures)
    if (!pending) {
      log("nenhuma partida pendente.")
    } else {
      try {
        await verifyMatch(pending.id, pending.match_id)
        state.failures.delete(pending.id)
        log(`partida ${pending.match_id} vinculada pela API.`)
      } catch (e) {
        if (e instanceof RateLimitError) {
          wait = Math.max(e.retryAfterMs ?? INTERVAL_MS, MIN_WAIT_MS)
          log(`limite da API: próxima tentativa em ${Math.round(wait / 60000)} min.`)
        } else {
          state.failures.set(pending.id, (state.failures.get(pending.id) ?? 0) + 1)
          log(`partida ${pending.match_id} não vinculada: ${e instanceof Error ? e.message : e}`)
        }
      }
    }
  } finally {
    state.timer = setTimeout(tick, wait)
  }
}

export function startAutoVerify() {
  if (g.autoVerify) return // já rodando (o modo de desenvolvimento recarrega módulos)
  g.autoVerify = { timer: setTimeout(tick, STARTUP_DELAY_MS), failures: new Map() }
  log("ativo: vai tentar vincular as partidas pendentes em segundo plano.")
}
