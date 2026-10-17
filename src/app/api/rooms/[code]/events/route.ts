import { getCurrentUser } from "@/lib/auth"
import { ROOM_CODE_PATTERN } from "@/lib/draft-rules"
import { getHeroes } from "@/lib/heroes"
import { joinRoom, roomPlayer } from "@/lib/room-store"

export const dynamic = "force-dynamic"

// Canal ao vivo da sala (Server-Sent Events): enquanto a conexão estiver aberta,
// o jogador está na sala e recebe o estado a cada mudança.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!ROOM_CODE_PATTERN.test(code)) return new Response("Sala inválida", { status: 404 })
  const user = await getCurrentUser()
  if (!user) return new Response("Faça login", { status: 401 })
  const heroIds = (await getHeroes()).map((h) => h.id)

  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }
      const send = (data: string) => write(`data: ${data}\n\n`)
      const leave = joinRoom(code, heroIds, roomPlayer(user), send)
      // Comentário SSE periódico (ignorado pelo navegador) para proxies não fecharem a conexão parada.
      const heartbeat = setInterval(() => write(": ping\n\n"), 15000)
      let closed = false
      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        leave()
        try {
          controller.close()
        } catch {}
      }
      request.signal.addEventListener("abort", cleanup)
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      // Exatamente "text/event-stream": com "; charset" o túnel do Cloudflare segura os dados em vez de repassar na hora.
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
