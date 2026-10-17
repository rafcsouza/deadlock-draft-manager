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

// Perfis do site que têm SteamID, por conta Steam. Nome e avatar do perfil valem acima do nome da Steam.
export function getProfilesBySteam() {
  const rows = db
    .prepare("SELECT id, username, avatar, steam_account_id FROM users WHERE steam_account_id IS NOT NULL")
    .all() as { id: number; username: string; avatar: string | null; steam_account_id: number }[]
  return new Map(rows.map((u) => [u.steam_account_id, u]))
}

export function getPlayerNames() {
  const rows = db.prepare("SELECT account_id, name FROM player_names").all() as { account_id: number; name: string }[]
  return new Map(rows.map((r) => [r.account_id, r.name]))
}
