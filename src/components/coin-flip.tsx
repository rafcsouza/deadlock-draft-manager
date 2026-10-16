"use client"

import { useEffect, useRef, useState } from "react"

type Team = "a" | "b"
type Side = { name: string; color: string; letter: string }

const SPIN_MS = 1600
const REVEAL_MS = 1200

// Cara ou coroa para decidir qual time começa o draft.
export function CoinFlip({ sides, onResult }: { sides: Record<Team, Side>; onResult: (team: Team) => void }) {
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<Team | null>(null)
  const [landed, setLanded] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function flip() {
    if (result) return
    const winner: Team = Math.random() < 0.5 ? "a" : "b"
    setResult(winner)
    // 5 voltas completas; meia volta a mais deixa a face do time B para cima.
    setRotation(360 * 5 + (winner === "b" ? 180 : 0))
    timers.current.push(
      window.setTimeout(() => setLanded(true), SPIN_MS),
      window.setTimeout(() => onResult(winner), SPIN_MS + REVEAL_MS),
    )
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-11 w-11 [perspective:400px]">
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${rotation}deg)`,
            transition: `transform ${SPIN_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)`,
          }}
        >
          <Face side={sides.a} />
          <Face side={sides.b} back />
        </div>
      </div>

      {landed && result ? (
        <span className="font-display text-lg font-bold uppercase tracking-wider">
          <span style={{ color: sides[result].color }}>{sides[result].name}</span> começa!
        </span>
      ) : (
        <button
          onClick={flip}
          disabled={result !== null}
          className="rounded-full border border-border bg-muted px-5 py-2 font-display text-sm font-bold uppercase tracking-wider transition-colors hover:border-muted-foreground disabled:opacity-60"
        >
          {result ? "Girando..." : "Jogar a moeda"}
        </button>
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
