import { redirect } from "next/navigation"
import { randomBytes } from "node:crypto"
import { requireUser } from "@/lib/auth"
import { getHeroes } from "@/lib/heroes"
import { createRoom } from "@/lib/room-store"

// Cada acesso cria uma sala nova, então a página não pode ser estática.
export const dynamic = "force-dynamic"

// ?tipo=aberta: a sala aparece na página inicial para qualquer um entrar. Sem isso, só por convite (o link).
export default async function NewDraftPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams
  const user = await requireUser(tipo ? `/draft/novo?tipo=${encodeURIComponent(tipo)}` : "/draft/novo")
  const code = randomBytes(4).toString("hex")
  const heroIds = (await getHeroes()).map((h) => h.id)
  createRoom(code, heroIds, String(user.id), tipo === "aberta")
  redirect(`/draft/${code}`)
}
