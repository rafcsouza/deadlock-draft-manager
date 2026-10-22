"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RoomAction, RoomView } from "@/lib/draft-rules"

const SSE_TIMEOUT_MS = 4000
const POLL_MS = 1000

// Conecta ao canal ao vivo da sala e expõe o estado, o relógio do servidor e o envio de ações.
// Se a conexão ao vivo não entregar nada em alguns segundos (ex.: túnel rápido do Cloudflare, que não
// suporta esse tipo de conexão), passa a perguntar o estado ao servidor a cada segundo.
export function useRoom(code: string) {
  const [view, setView] = useState<RoomView | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // O dono excluiu a sala.
  const [closed, setClosed] = useState(false)
  // Diferença entre o relógio do servidor e o deste navegador, para o timer bater com o de todos.
  const offset = useRef(0)
  // Quando em modo de consulta, permite buscar o estado logo depois de uma ação.
  const pollNow = useRef<(() => void) | null>(null)

  useEffect(() => {
    let stopped = false
    let pollTimer: ReturnType<typeof setTimeout> | undefined
    let gotMessage = false

    const apply = (next: RoomView) => {
      offset.current = next.serverNow - Date.now()
      setView(next)
      setConnected(true)
      if (next.closed) end()
    }
    // Sala encerrada: para de ouvir e de perguntar.
    const end = () => {
      stopped = true
      setClosed(true)
      source.close()
      clearTimeout(pollTimer)
    }

    const source = new EventSource(`/api/rooms/${code}/events`)
    source.onerror = () => setConnected(false) // o EventSource reconecta sozinho
    source.onmessage = (e) => {
      gotMessage = true
      apply(JSON.parse(e.data))
    }

    async function poll() {
      if (stopped) return
      clearTimeout(pollTimer)
      try {
        const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" })
        if (res.status === 410) return end()
        if (res.ok) apply(await res.json())
        else setConnected(false)
      } catch {
        setConnected(false)
      }
      if (!stopped) pollTimer = setTimeout(poll, POLL_MS)
    }

    const fallback = setTimeout(() => {
      if (gotMessage || stopped) return
      source.close()
      pollNow.current = () => void poll()
      void poll()
    }, SSE_TIMEOUT_MS)

    return () => {
      stopped = true
      clearTimeout(fallback)
      clearTimeout(pollTimer)
      pollNow.current = null
      source.close()
    }
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
      // Em modo de consulta, mostra o resultado da ação na hora, sem esperar a próxima consulta.
      pollNow.current?.()
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

  return { view, connected, error, closed, send, serverNow }
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
