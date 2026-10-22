"use client"

import { BackLink } from "@/components/back-link"
import { SoundMenu } from "@/components/sound-toggle"
import { useState } from "react"
import { chooseSound, playSound, playVoice, SOUNDS, useSoundSettings, type SoundEvent } from "@/lib/sound"

// Página de sons: ouvir as opções de cada momento e escolher a preferida (fica salva neste navegador).
// Volume, mudo e falas ficam no botão "Sons" do topo.
export function SoundBoard({ heroes }: { heroes: { id: number; name: string; voices: { pick: string[]; ban: string[] } }[] }) {
  const settings = useSoundSettings()
  const [heroId, setHeroId] = useState(heroes[0]?.id ?? 0)
  const hero = heroes.find((h) => h.id === heroId)
  const events = Object.keys(SOUNDS) as SoundEvent[]

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <BackLink />
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Sons</h1>
        <div className="ml-auto">
          <SoundMenu label />
        </div>
      </header>

      {/* Falas dos heróis: tocam quando um herói é escolhido ou banido no draft. */}
      <section className="mb-4 space-y-3 rounded-2xl border border-border bg-card/80 p-4" data-sound="none">
        <p className="text-sm font-semibold">Falas dos heróis (positiva no pick, de desdém no ban)</p>
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
          <button
            onClick={() => hero && void playVoice(hero.voices.pick, { force: true, kind: "pick" })}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            ▶ Pick
          </button>
          <button
            onClick={() => hero && void playVoice(hero.voices.ban, { force: true, kind: "ban" })}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            ▶ Ban
          </button>
        </div>
      </section>

      <p className="mb-4 text-xs text-muted-foreground">
        Clique em ▶ para ouvir e em <b className="text-foreground">Usar</b> para escolher. A escolha vale para este navegador. Cada som sai um pouco diferente a cada vez, de propósito.
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
