import type { ResultPlayer } from "@/lib/draft-rules"

// Formatação usada tanto no servidor (histórico) quanto no navegador (sala).
export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
export const formatSouls = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
export const playerName = (p: ResultPlayer) => p.name ?? p.steamName ?? `Steam ${p.accountId}`

// Datas sempre no horário de Brasília (o servidor pode estar em outro fuso).
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" })
export const formatDateTime = (ms: number) => dateTimeFormat.format(ms)
export const formatDate = (ms: number) => dateFormat.format(ms)

// "São Paulo" → "Sao Paulo".
export const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")

// Mensagem de um erro capturado, ou o texto padrão quando não é um Error.
export const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
