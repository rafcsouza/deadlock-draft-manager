import { SoundBoard } from "@/components/sound-board"
import { requireUser } from "@/lib/auth"
import { getHeroes } from "@/lib/heroes"

export const metadata = { title: "Sons" }

export default async function SoundsPage() {
  await requireUser("/sons")
  const heroes = (await getHeroes())
    .filter((h) => h.voices.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((h) => ({ id: h.id, name: h.name, voices: h.voices }))
  return <SoundBoard heroes={heroes} />
}
