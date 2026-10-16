"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/auth"
import { getHeroes } from "@/lib/heroes"
import { importMatch, savePrintMatch, verifyMatch } from "@/lib/match-results"
import { readPrint, reviewToPlayers } from "@/lib/print-import"
import type { PrintReview } from "@/lib/print-types"

export type ImportState = { error?: string; ok?: string }

const parseMatchId = (value: FormDataEntryValue | null) => {
  const id = Number(String(value ?? "").trim())
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const refresh = () => {
  revalidatePath("/historico")
  revalidatePath("/leaderboards")
}

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

export async function importMatchAction(_: ImportState, form: FormData): Promise<ImportState> {
  if (!(await getCurrentUser())) return { error: "Faça login." }
  const matchId = parseMatchId(form.get("matchId"))
  if (!matchId) return { error: "ID da partida inválido." }
  try {
    await importMatch(matchId)
  } catch (e) {
    return { error: message(e, "Não foi possível importar a partida.") }
  }
  refresh()
  return { ok: `Partida ${matchId} adicionada ao histórico.` }
}

// Print do placar, etapa 1: lê com OCR local e devolve os dados para revisão (nada é salvo).
export async function readPrintAction(form: FormData): Promise<{ error?: string; review?: PrintReview }> {
  if (!(await getCurrentUser())) return { error: "Faça login." }
  const file = form.get("screenshot")
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha o print do placar." }
  try {
    return { review: await readPrint(file, await getHeroes()) }
  } catch (e) {
    return { error: message(e, "Não foi possível ler o print.") }
  }
}

// Etapa 2: salva o que foi revisado. Entra no histórico como pendente, fora do leaderboard.
export async function savePrintAction(review: PrintReview): Promise<ImportState> {
  if (!(await getCurrentUser())) return { error: "Faça login." }
  try {
    savePrintMatch(reviewToPlayers(review, await getHeroes()))
  } catch (e) {
    return { error: message(e, "Não foi possível salvar a partida.") }
  }
  refresh()
  return { ok: "Partida adicionada ao histórico como pendente. Vincule pela API quando puder." }
}

export async function verifyMatchAction(_: ImportState, form: FormData): Promise<ImportState> {
  if (!(await getCurrentUser())) return { error: "Faça login." }
  const matchId = parseMatchId(form.get("matchId"))
  if (!matchId) return { error: "ID da partida inválido." }
  try {
    await verifyMatch(String(form.get("draftId") ?? ""), matchId)
  } catch (e) {
    return { error: message(e, "Não foi possível vincular a partida.") }
  }
  refresh()
  return { ok: "Partida confirmada pela API." }
}
