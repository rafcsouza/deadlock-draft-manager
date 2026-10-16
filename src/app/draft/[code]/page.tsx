import { DraftRoom } from "@/components/draft-room"
import { getHeroes } from "@/lib/heroes"

export const metadata = { title: "Sala de Draft" }

export default async function DraftRoomPage() {
  const heroes = await getHeroes()
  const sorted = [...heroes].sort((a, b) => a.name.localeCompare(b.name))

  return <DraftRoom heroes={sorted} />
}
