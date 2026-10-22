"use client"

import { playSound, setMuted, useSoundSettings } from "@/lib/sound"

// Liga/desliga os sons do site (vale só para este navegador).
export function SoundToggle() {
  const { muted } = useSoundSettings()
  return (
    <button
      onClick={() => {
        setMuted(!muted)
        if (muted) playSound("click")
      }}
      title={muted ? "Ligar sons" : "Desligar sons"}
      aria-label={muted ? "Ligar sons" : "Desligar sons"}
      aria-pressed={!muted}
      data-sound="none"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {muted ? (
          <path d="m23 9-6 6M17 9l6 6" />
        ) : (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 5a10 10 0 0 1 0 14" />
          </>
        )}
      </svg>
    </button>
  )
}
