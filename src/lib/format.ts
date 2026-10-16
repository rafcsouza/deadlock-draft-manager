import type { ResultPlayer } from "@/lib/draft-rules"

// Formatação usada tanto no servidor (histórico) quanto no navegador (sala).
export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
export const formatSouls = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
export const playerName = (p: ResultPlayer) => p.name ?? p.steamName ?? `Steam ${p.accountId}`
