"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RoomAction, RoomView } from "@/lib/draft-rules"

// Conecta ao canal ao vivo da sala e expõe o estado, o relógio do servidor e o envio de ações.
export function useRoom(code: string) {
  const [view, setView] = useState<RoomView | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Diferença entre o relógio do servidor e o deste navegador, para o timer bater com o de todos.
  const offset = useRef(0)

  useEffect(() => {
    const source = new EventSource(`/api/rooms/${code}/events`)
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false) // o EventSource reconecta sozinho
    source.onmessage = (e) => {
      const next: RoomView = JSON.parse(e.data)
      offset.current = next.serverNow - Date.now()
      setView(next)
      setConnected(true)
    }
    return () => source.close()
  }, [code])

  const send = useCallback(
    async (action: RoomAction) => {
      try {
        const res = await fetch(`/api/rooms/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        })
        if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Algo deu errado.")
      } catch {
        setError("Sem conexão com o servidor.")
      }
    },
    [code],
  )

  // Some sozinho depois de alguns segundos.
  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 3500)
    return () => window.clearTimeout(id)
  }, [error])

  const serverNow = useCallback(() => Date.now() + offset.current, [])

  return { view, connected, error, send, serverNow }
}

// Horário do servidor atualizado algumas vezes por segundo (para timer e moeda).
export function useServerClock(serverNow: () => number, active: boolean) {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    setNow(serverNow())
    if (!active) return
    const id = window.setInterval(() => setNow(serverNow()), 250)
    return () => window.clearInterval(id)
  }, [serverNow, active])
  return now
}
