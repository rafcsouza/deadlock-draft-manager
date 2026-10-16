"use client"

import { useEffect, useState } from "react"
import { COIN_SPIN_MS, type Team } from "@/lib/draft-rules"

type Side = { name: string; color: string; letter: string }

type Props = {
  sides: Record<Team, Side>
  // Resultado sorteado pelo servidor (null enquanto ninguém jogou).
  result: Team | null
  coinAt: number | null
  now: number
  canFlip: boolean
  onFlip: () => void
  // Texto depois do nome do time vencedor (ex.: "começa!").
  resultText?: string
}

// Cara ou coroa para decidir qual time começa. Quem joga é um capitão; todos veem a mesma moeda.
export function CoinFlip({ sides, result, coinAt, now, canFlip, onFlip, resultText = "começa!" }: Props) {
  const target = result ? 360 * 5 + (result === "b" ? 180 : 0) : 0
  const [rotation, setRotation] = useState(0)
  const [animate, setAnimate] = useState(true)
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    if (!result || coinAt === null) {
      setRotation(0)
      setRequested(false)
      return
    }
    // Quem chegou depois do giro só vê a moeda já caída.
    if (now - coinAt > COIN_SPIN_MS) {
      setAnimate(false)
      setRotation(target)
      return
    }
    setAnimate(true)
    const id = requestAnimationFrame(() => setRotation(target))
    return () => cancelAnimationFrame(id)
    // coinAt identifica cada jogada da moeda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, coinAt])

  const landed = result !== null && coinAt !== null && now >= coinAt + COIN_SPIN_MS

  return (
    <div className="flex items-center gap-4">
      <div className="h-11 w-11 [perspective:400px]">
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${rotation}deg)`,
            transition: animate ? `transform ${COIN_SPIN_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)` : "none",
          }}
        >
          <Face side={sides.a} />
          <Face side={sides.b} back />
        </div>
      </div>

      {landed && result ? (
        <span className="font-display text-lg font-bold uppercase tracking-wider">
          <span style={{ color: sides[result].color }}>{sides[result].name}</span> {resultText}
        </span>
      ) : result ? (
        <span className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Girando...</span>
      ) : canFlip ? (
        <button
          onClick={() => {
            setRequested(true)
            onFlip()
            // Libera de novo se o servidor recusar (ex.: um capitão saiu do time).
            window.setTimeout(() => setRequested(false), 3000)
          }}
          disabled={requested}
          className="rounded-full border border-border bg-muted px-5 py-2 font-display text-sm font-bold uppercase tracking-wider transition-colors hover:border-muted-foreground disabled:opacity-60"
        >
          Jogar a moeda
        </button>
      ) : (
        <span className="text-sm text-muted-foreground">Aguardando um capitão jogar a moeda</span>
      )}
    </div>
  )
}

function Face({ side, back }: { side: Side; back?: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-full border-2 font-display text-lg font-bold text-white shadow-lg shadow-black/50"
      style={{
        background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${side.color} 75%, white), ${side.color} 60%)`,
        borderColor: `color-mix(in oklab, ${side.color} 60%, black)`,
        backfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : undefined,
      }}
    >
      {side.letter}
    </div>
  )
}
