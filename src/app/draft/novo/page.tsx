import { redirect } from "next/navigation"
import { randomBytes } from "node:crypto"
import { requireUser } from "@/lib/auth"
import { getHeroes } from "@/lib/heroes"
import { parseOrder } from "@/lib/draft-rules"
import { createRoom } from "@/lib/room-store"

// Cada acesso cria uma sala nova, então a página não pode ser estática.
export const dynamic = "force-dynamic"

// ?tipo=aberta: a sala aparece na página inicial para qualquer um entrar. Sem isso, só por convite (o link).
// ?ordem=alternado: bans e picks um de cada time (1-1-1); sem isso, a ordem competitiva.
export default async function NewDraftPage({ searchParams }: { searchParams: Promise<{ tipo?: string; ordem?: string }> }) {
  const { tipo, ordem } = await searchParams
  const query = new URLSearchParams({ ...(tipo && { tipo }), ...(ordem && { ordem }) }).toString()
  const user = await requireUser(query ? `/draft/novo?${query}` : "/draft/novo")
  const code = randomBytes(4).toString("hex")
  const heroIds = (await getHeroes()).map((h) => h.id)
  createRoom(code, heroIds, String(user.id), tipo === "aberta", parseOrder(ordem))
  redirect(`/draft/${code}`)
}
