"use client"

import { BackLink } from "@/components/back-link"
import { useState } from "react"
import {
  chooseSound,
  playSound,
  playVoice,
  setMuted,
  setVoice,
  setVoiceVolume,
  setVolume,
  SOUNDS,
  useSoundSettings,
  type SoundEvent,
} from "@/lib/sound"

// Página de sons: ouvir as opções de cada momento e escolher a preferida (fica salva neste navegador).
export function SoundBoard({ heroes }: { heroes: { id: number; name: string; voices: string[] }[] }) {
  const settings = useSoundSettings()
  const [heroId, setHeroId] = useState(heroes[0]?.id ?? 0)
  const hero = heroes.find((h) => h.id === heroId)
  const events = Object.keys(SOUNDS) as SoundEvent[]

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <BackLink />
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Sons</h1>
      </header>

      <section className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card/80 p-4">
        <label className="flex flex-1 items-center gap-3 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            onPointerUp={() => playSound("click")}
            className="flex-1 accent-[var(--team-a)]"
          />
          <span className="w-10 text-right font-mono text-xs tabular-nums">{Math.round(settings.volume * 100)}%</span>
        </label>
        <button
          onClick={() => setMuted(!settings.muted)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            settings.muted ? "border-red-600/50 text-red-300" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {settings.muted ? "Sons desligados" : "Sons ligados"}
        </button>
      </section>

      {/* Falas dos heróis: tocam quando um herói é escolhido no draft, como no jogo. */}
      <section className="mb-4 space-y-3 rounded-2xl border border-border bg-card/80 p-4" data-sound="none">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm font-semibold">Fala do herói ao ser escolhido</p>
          <button
            onClick={() => setVoice(!settings.voice)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              settings.voice ? "border-green-500/50 text-green-300" : "border-border text-muted-foreground"
            }`}
          >
            {settings.voice ? "Falas ligadas" : "Falas desligadas"}
          </button>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Volume das falas</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.voiceVolume}
            onChange={(e) => setVoiceVolume(Number(e.target.value))}
            className="flex-1 accent-[var(--team-a)]"
          />
          <span className="w-10 text-right font-mono text-xs tabular-nums">{Math.round(settings.voiceVolume * 100)}%</span>
        </label>
        <div className="flex gap-2">
          <select
            value={heroId}
            onChange={(e) => setHeroId(Number(e.target.value))}
            aria-label="Herói"
            className="min-w-0 flex-1 rounded-lg border border-border bg-muted/60 px-2 py-1.5 text-sm"
          >
            {heroes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button onClick={() => hero && void playVoice(hero.voices, { force: true })} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
            ▶ Ouvir uma fala
          </button>
        </div>
      </section>

      <p className="mb-4 text-xs text-muted-foreground">
        Clique em ▶ para ouvir e em <b className="text-foreground">Usar</b> para escolher. A escolha vale para este navegador. Cada som sai um
        pouco diferente a cada vez, de propósito.
      </p>

      <ul className="space-y-2" data-sound="none">
        {events.map((event) => {
          const chosen = settings.choice[event] ?? 0
          return (
            <li key={event} className="rounded-2xl border border-border bg-card/80 p-3">
              <p className="mb-2 text-sm font-semibold">{SOUNDS[event].label}</p>
              <div className="flex flex-wrap gap-2">
                {SOUNDS[event].options.map((option, i) => (
                  <div
                    key={i}
                    className={`flex items-center overflow-hidden rounded-lg border text-xs ${chosen === i ? "border-[var(--team-a)]" : "border-border"}`}
                  >
                    <button onClick={() => playSound(event, i)} className="px-2.5 py-1.5 hover:bg-muted" aria-label={`Ouvir ${option.label}`}>
                      ▶ <span className="font-semibold">{String.fromCharCode(65 + i)}</span> · {option.label}
                    </button>
                    <button
                      onClick={() => {
                        chooseSound(event, i)
                        playSound(event, i)
                      }}
                      className={`border-l px-2.5 py-1.5 font-semibold ${
                        chosen === i ? "border-[var(--team-a)] bg-[var(--team-a)] text-black" : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {chosen === i ? "Usando" : "Usar"}
                    </button>
                  </div>
                ))}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Sons do jogo e falas dos heróis: Deadlock (Valve), servidos pela{" "}
        <a href="https://deadlock-api.com" target="_blank" rel="noopener noreferrer" className="underline">
          Deadlock API
        </a>
        . Alternativas: pacotes do{" "}
        <a href="https://kenney.nl" target="_blank" rel="noopener noreferrer" className="underline">
          Kenney
        </a>{" "}
        (domínio público). Os bipes simples são gerados pelo navegador.
      </p>
    </main>
  )
}
