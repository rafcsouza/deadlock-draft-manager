// Converte o que a pessoa digitar no cadastro para o account_id da Steam
// (SteamID3, 32 bits), que é como a API do Deadlock identifica os jogadores.
// Aceita: SteamID64 (7656119...), link /profiles/<SteamID64>, [U:1:N] e o código de amigo (N).

const STEAM64_BASE = BigInt("76561197960265728")
const MAX_ACCOUNT_ID = 0xffffffff

export type SteamParse = { accountId: number } | { error: string }

export function parseSteamId(raw: string): SteamParse {
  const input = raw.trim()
  if (!input) return { error: "Informe o seu SteamID64." }

  if (/steamcommunity\.com\/id\//i.test(input)) {
    return {
      error:
        "Links com nome personalizado (/id/...) não servem. Use o SteamID64 de 17 dígitos (veja em steamid.io) ou o link /profiles/7656....",
    }
  }

  const profile = input.match(/steamcommunity\.com\/profiles\/(\d{17})/i)
  const steam3 = input.match(/^\[?U:1:(\d+)\]?$/i)
  const digits = profile?.[1] ?? (/^\d+$/.test(input) ? input : null)

  let accountId: number | null = null
  if (steam3) {
    accountId = Number(steam3[1])
  } else if (digits && digits.length === 17 && digits.startsWith("7656")) {
    accountId = Number(BigInt(digits) - STEAM64_BASE)
  } else if (digits && digits.length <= 10) {
    // Código de amigo da Steam = account_id.
    accountId = Number(digits)
  }

  if (accountId === null || !Number.isInteger(accountId) || accountId <= 0 || accountId > MAX_ACCOUNT_ID) {
    return { error: "SteamID inválido. Use o SteamID64 de 17 dígitos (começa com 7656119...)." }
  }
  return { accountId }
}

export function toSteam64(accountId: number) {
  return (STEAM64_BASE + BigInt(accountId)).toString()
}
