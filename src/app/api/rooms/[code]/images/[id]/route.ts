import { getCurrentUser } from "@/lib/auth"
import { getRoomImage } from "@/lib/room-store"

export const dynamic = "force-dynamic"

// Imagem enviada no chat de uma sala. Fica só na memória do servidor: quando a sala fecha, some.
export async function GET(_: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params
  if (!(await getCurrentUser())) return new Response("Faça login", { status: 401 })
  const image = getRoomImage(code, id)
  if (!image) return new Response("Imagem expirada", { status: 404 })
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.type, "Cache-Control": "private, max-age=86400, immutable" },
  })
}
