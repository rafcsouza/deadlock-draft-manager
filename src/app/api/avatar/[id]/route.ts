import { db } from "@/lib/db"

// Serve o avatar guardado no banco como imagem. A URL leva uma versão (?v=),
// então pode ficar em cache por bastante tempo.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = db.prepare("SELECT avatar FROM users WHERE id = ?").get(Number(id)) as { avatar: string | null } | undefined
  const match = row?.avatar?.match(/^data:(image\/(?:webp|png|jpeg));base64,(.+)$/)
  if (!match) return new Response("Sem avatar", { status: 404 })

  return new Response(Buffer.from(match[2], "base64"), {
    headers: { "Content-Type": match[1], "Cache-Control": "public, max-age=31536000, immutable" },
  })
}
