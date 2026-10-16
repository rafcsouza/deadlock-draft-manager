import { getCurrentUser } from "@/lib/auth"
import type { RoomAction } from "@/lib/draft-rules"
import { applyAction, submitMatch } from "@/lib/room-store"

export const dynamic = "force-dynamic"

// Ações na sala (mover jogador, moeda, escolher herói, chat...). O servidor valida
// as permissões e, se der certo, avisa todos pelo canal ao vivo.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 })

  let action: RoomAction
  try {
    action = await request.json()
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 })
  }

  // Buscar a partida na API é assíncrono; as demais ações são imediatas.
  const error =
    action?.type === "submitMatch"
      ? await submitMatch(code, String(user.id), String(action.matchId ?? ""))
      : applyAction(code, String(user.id), action)
  return error ? Response.json({ error }, { status: 400 }) : Response.json({ ok: true })
}
