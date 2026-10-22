"use client"

import { useEffect, useRef } from "react"
import { buildSteps, COIN_SPIN_MS, TOTAL_STEPS, type RoomView } from "@/lib/draft-rules"
import { playSound, playVoice, preloadSounds } from "@/lib/sound"

// Sons dos acontecimentos da sala. Tocam quando o estado muda (para todos ouvirem o mesmo,
// seja quem for que agiu), comparando com o estado anterior; o carregamento inicial não toca nada.
export function useRoomSounds({
  view,
  meId,
  myTurn,
  secondsLeft,
  error,
  now,
  voicesOf,
}: {
  view: RoomView
  meId: string
  // É a sua vez (de banir, escolher herói ou escolher jogador).
  myTurn: boolean
  // Segundos restantes do turno atual (null fora do draft de heróis).
  secondsLeft: number | null
  error: string | null
  now: number
  // Falas de seleção de um herói (tocadas quando ele é escolhido, como no jogo).
  voicesOf: (heroId: number) => string[]
}) {
  const prev = useRef<{
    actions: number
    picks: number
    lastChat?: string
    coinAt: number | null
    started: boolean
    myTurn: boolean
  } | null>(null)

  useEffect(() => preloadSounds(), [])

  useEffect(() => {
    const p = prev.current
    const snap = {
      actions: view.actions.length,
      picks: view.playerPicks,
      lastChat: view.chat.at(-1)?.id,
      coinAt: view.coinAt,
      started: view.playerFirst !== null,
      myTurn,
    }
    prev.current = snap
    if (!p) return

    // Início do draft (alguém clicou em "Iniciar draft"): som marcante, junto com a moeda.
    if (snap.started && !p.started) playSound("draftStart")

    if (snap.actions > p.actions) {
      const step = buildSteps(view.first)[snap.actions - 1]
      playSound(snap.actions === TOTAL_STEPS ? "finished" : step.action)
      // Herói escolhido: a fala dele entra logo depois do som de confirmar.
      if (step.action === "pick") void playVoice(voicesOf(view.actions[snap.actions - 1]), { delay: 0.3 })
    }
    if (snap.picks > p.picks) playSound("playerPick")
    else if (snap.picks < p.picks && view.playerFirst) playSound("undo")

    const last = view.chat.at(-1)
    if (last && snap.lastChat !== p.lastChat && last.authorId !== meId) playSound("chat")

    // Moeda: gira e, quando a animação termina, cai.
    if (snap.coinAt && snap.coinAt !== p.coinAt) {
      playSound("coinSpin")
      const landIn = snap.coinAt + COIN_SPIN_MS - now
      if (landIn > -500) window.setTimeout(() => playSound("coinLand"), Math.max(0, landIn))
    }

    if (snap.myTurn && !p.myTurn) playSound("yourTurn")
    // now muda várias vezes por segundo; só os campos da sala importam aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.actions.length, view.playerPicks, view.chat, view.coinAt, view.playerFirst, myTurn])

  // Tique nos últimos 5 segundos do turno.
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 5) playSound("tick")
  }, [secondsLeft])

  useEffect(() => {
    if (error) playSound("error")
  }, [error])
}
