"use client"

import { useEffect, useRef } from "react"
import { buildSteps, COIN_SPIN_MS, TOTAL_STEPS, type RoomView } from "@/lib/draft-rules"
import type { Hero } from "@/lib/heroes"
import { playSound, playVoice, preloadSounds } from "@/lib/sound"

// Sons dos acontecimentos da sala. Tocam quando o estado muda (para todos ouvirem o mesmo,
// seja quem for que agiu), comparando com o estado anterior; o carregamento inicial não toca nada.
// Quando vários acontecem juntos, eles se revezam em vez de tocar um em cima do outro.

// Espera do aviso de "sua vez" e da vinheta de fim quando chegam junto com a fala de um herói
// (para não tocarem um em cima do outro). Sem fala tocando agora, eles entram na hora.
const AFTER_VOICE_MS = 1200
const END_AFTER_VOICE_MS = 1800

// O que esta tela já tocou na hora do clique (antes da confirmação do servidor), para não repetir:
// a fala do herói marcado e a vinheta de início de quem clicou em "Iniciar draft".
export type PlayedEarly = { hero: number | null; start: boolean }
export function useRoomSounds({
  view,
  meId,
  myTurn,
  secondsLeft,
  error,
  now,
  voicesOf,
  playedEarly,
}: {
  view: RoomView
  meId: string
  // É a sua vez (de banir, escolher herói ou escolher jogador).
  myTurn: boolean
  // Segundos restantes do turno atual (null fora do draft de heróis).
  secondsLeft: number | null
  error: string | null
  now: number
  // Falas do herói: a positiva quando ele é escolhido, a de morte quando é banido.
  voicesOf: (heroId: number) => Hero["voices"]
  playedEarly: { current: PlayedEarly }
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

    // Início do draft (alguém clicou em "Iniciar draft"): a vinheta toca no lugar do giro da moeda.
    const justStarted = snap.started && !p.started
    if (justStarted && !playedEarly.current.start) playSound("draftStart")
    if (justStarted) playedEarly.current.start = false

    // Ban: som de ban + fala de desdém do herói. Pick: som de confirmar + fala positiva.
    // Quem agiu já ouviu a fala no clique; os outros ouvem agora, na hora em que a ação chega.
    const acted = snap.actions > p.actions
    let voiced = false
    if (acted) {
      const heroId = view.actions[snap.actions - 1]
      const step = buildSteps(view.first, view.order)[snap.actions - 1]
      playSound(step.action)
      if (playedEarly.current.hero !== heroId) {
        const voices = voicesOf(heroId)
        void playVoice(step.action === "pick" ? voices.pick : voices.ban, { kind: step.action })
        voiced = true
      }
      // Qualquer ação encerra a marcação (inclusive a escolha automática quando o tempo acaba).
      playedEarly.current.hero = null
      if (snap.actions === TOTAL_STEPS) {
        if (voiced) window.setTimeout(() => playSound("finished"), END_AFTER_VOICE_MS)
        else playSound("finished")
      }
    }
    if (snap.picks > p.picks) playSound("playerPick")
    else if (snap.picks < p.picks && view.playerFirst) playSound("undo")

    const last = view.chat.at(-1)
    if (last && snap.lastChat !== p.lastChat && last.authorId !== meId) playSound("chat")

    // Moeda: gira e, quando a animação termina, cai.
    if (snap.coinAt && snap.coinAt !== p.coinAt) {
      if (!justStarted) playSound("coinSpin")
      const landIn = snap.coinAt + COIN_SPIN_MS - now
      if (landIn > -500) window.setTimeout(() => playSound("coinLand"), Math.max(0, landIn))
    }

    if (snap.myTurn && !p.myTurn && snap.actions < TOTAL_STEPS) {
      if (voiced) window.setTimeout(() => playSound("yourTurn"), AFTER_VOICE_MS)
      else playSound("yourTurn")
    }
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
