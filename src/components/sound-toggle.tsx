"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { playSound, setMuted, setVoice, setVoiceVolume, setVolume, useSoundSettings } from "@/lib/sound"

// Alto-falante que abre os ajustes de som de quem está usando (salvos neste navegador): ligar e
// desligar, volume e falas dos heróis, com o atalho para a página que escolhe o som de cada momento.
export function SoundMenu({ align = "right", label }: { align?: "left" | "right"; label?: boolean }) {
  const settings = useSoundSettings()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => box.current?.contains(e.target as Node) || setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={box} className="relative" data-sound="none">
      <button
        onClick={() => {
          setOpen(!open)
          playSound("click")
        }}
        title="Ajustes de som"
        aria-label="Ajustes de som"
        aria-expanded={open}
        className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${label ? "px-2.5" : "w-8"} hover:bg-muted hover:text-foreground ${
          open ? "bg-muted text-foreground" : "text-muted-foreground"
        }`}
      >
        <SpeakerIcon muted={settings.muted} />
        {label && "Sons"}
      </button>

      {open && (
        <div
          className={`absolute top-10 z-50 w-64 space-y-3 rounded-xl border border-border bg-card p-3 text-left shadow-2xl shadow-black/60 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <Row label="Sons" on={!settings.muted} onToggle={() => {
            setMuted(!settings.muted)
            if (settings.muted) playSound("click")
          }} />
          <Slider label="Volume" value={settings.volume} disabled={settings.muted} onChange={setVolume} onDone={() => playSound("click")} />
          <Row label="Falas dos heróis" on={settings.voice} onToggle={() => setVoice(!settings.voice)} />
          <Slider label="Volume das falas" value={settings.voiceVolume} disabled={settings.muted || !settings.voice} onChange={setVoiceVolume} />
          <Link
            href="/sons"
            onClick={() => setOpen(false)}
            className="block rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Escolher os sons →
          </Link>
        </div>
      )}
    </div>
  )
}

// Páginas com cabeçalho próprio, onde o alto-falante fica no cabeçalho em vez de flutuar.
const WITH_HEADER = /^\/(draft\/(?!novo)|historico|leaderboards|jogador|sons)/

// Botão de som fixo no canto da tela, nas páginas de card (home, entrar, perfil...).
export function FloatingSoundMenu() {
  const path = usePathname()
  if (WITH_HEADER.test(path)) return null
  return (
    <div className="fixed right-3 top-3 z-40 rounded-xl border border-border bg-card/80 shadow-lg shadow-black/40 backdrop-blur">
      <SoundMenu label />
    </div>
  )
}

function Row({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between text-sm font-semibold" aria-pressed={on}>
      {label}
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-green-600" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  )
}

function Slider({
  label,
  value,
  disabled,
  onChange,
  onDone,
}: {
  label: string
  value: number
  disabled?: boolean
  onChange: (v: number) => void
  onDone?: () => void
}) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <span className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
        <span className="font-mono tabular-nums">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onDone}
        className="mt-1 w-full accent-[var(--team-a)]"
      />
    </label>
  )
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
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
  )
}
