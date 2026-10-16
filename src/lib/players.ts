import "server-only"
import { db } from "@/lib/db"

// Contas Steam ligadas (mesma pessoa jogando em mais de uma conta) e nomes fixos de jogadores.

export function getAccountLinks() {
  const rows = db.prepare("SELECT account_id, main_account_id FROM account_links").all() as {
    account_id: number
    main_account_id: number
  }[]
  const mainOf = new Map(rows.map((r) => [r.account_id, r.main_account_id]))
  return {
    // Conta principal da pessoa (a própria conta, se não estiver ligada a outra).
    main: (accountId: number) => mainOf.get(accountId) ?? accountId,
    // Todas as contas da pessoa, incluindo a principal.
    accounts: (mainId: number) => [mainId, ...rows.filter((r) => r.main_account_id === mainId && r.account_id !== mainId).map((r) => r.account_id)],
  }
}

export function getPlayerNames() {
  const rows = db.prepare("SELECT account_id, name FROM player_names").all() as { account_id: number; name: string }[]
  return new Map(rows.map((r) => [r.account_id, r.name]))
}
