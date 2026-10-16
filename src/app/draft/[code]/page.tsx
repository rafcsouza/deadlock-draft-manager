import { DraftRoom } from "@/components/draft-room"
import { requireUser } from "@/lib/auth"
import { ROOM_CODE_PATTERN } from "@/lib/draft-rules"
import { getHeroes } from "@/lib/heroes"
import { notFound } from "next/navigation"

export const metadata = { title: "Sala de Draft" }

export default async function DraftRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!ROOM_CODE_PATTERN.test(code)) notFound()
  // Quem abre o link sem estar logado entra (ou cria o perfil) e volta para a sala.
  const user = await requireUser(`/draft/${code}`)
  const heroes = await getHeroes()
  const sorted = [...heroes].sort((a, b) => a.name.localeCompare(b.name))

  return <DraftRoom code={code} heroes={sorted} meId={String(user.id)} />
}
