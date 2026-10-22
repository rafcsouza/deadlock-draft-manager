"use client"

import { useSyncExternalStore } from "react"

// Efeitos sonoros do site. Por padrão, sons do próprio Deadlock (servidos pela API do Deadlock, nada
// guardado aqui), com o volume de cada um igualado a um alvo; como alternativa, pacotes do Kenney
// (domínio público, em /public/sounds) e sons gerados na hora (Web Audio) para bipes simples.
// Cada toque sai com tom e volume levemente diferentes, para não cansar (o truque do Balatro).
// Cada momento tem opções (A, B, C); a escolhida e o volume ficam salvos neste navegador.

export type SoundEvent =
  | "hover"
  | "mark"
  | "ban"
  | "pick"
  | "playerPick"
  | "undo"
  | "yourTurn"
  | "tick"
  | "coinSpin"
  | "coinLand"
  | "chat"
  | "draftStart"
  | "finished"
  | "error"
  | "click"

// start: instante (no relógio do AudioContext) em que o som começa.
type Synth = (ctx: AudioContext, out: AudioNode, start: number) => void

// Camada de um som composto: um arquivo ou um som gerado, começando "at" segundos depois.
type Layer = { file?: string; synth?: Synth; at: number; volume?: number }

type SoundOption = {
  label: string
  // Arquivos em /sounds (sem extensão) ou do jogo ("game:ui/hero_select"); um deles é sorteado a cada toque.
  files?: string[]
  // Volume-alvo (RMS) para sons do jogo, que vêm com volumes muito diferentes entre si: cada arquivo é
  // ajustado para chegar nele (em vez de usar "volume").
  loudness?: number
  // Corta sons longos (as vinhetas do jogo têm 15 s), com o volume caindo no final.
  maxDuration?: number
  synth?: Synth
  // Sequência especial (ex.: moeda girando: vários tilintares cada vez mais rápidos).
  sequence?: "rattle-metal" | "rattle-tin"
  // Som composto (início e fim do draft): várias camadas em sequência.
  layers?: Layer[]
  volume?: number
  // Variação de tom (0.08 = até 8% mais grave ou mais agudo).
  pitch?: number
}

const GAME_SOUNDS = "https://assets-bucket.deadlock-api.com/assets-api-res/sounds/"
const heroCardHovers = [1, 2, 3, 4, 5, 6, 7].map((n) => `game:ui/ui_herocard_hover_0${n}`)

const metal = ["impactmetal-light-000", "impactmetal-light-001", "impactmetal-light-002", "impactmetal-light-003", "impactmetal-light-004"]

export const SOUNDS: Record<SoundEvent, { label: string; options: SoundOption[] }> = {
  hover: {
    label: "Passar o mouse num herói",
    options: [
      { label: "Card de herói (Deadlock)", files: heroCardHovers, loudness: 0.012, pitch: 0.03 },
      { label: "Switch mecânico", files: ["switch2"], volume: 0.35, pitch: 0.12 },
      { label: "Switch mais seco", files: ["switch10"], volume: 0.35, pitch: 0.12 },
      { label: "Rollover suave", files: ["rollover2", "rollover3"], volume: 0.3, pitch: 0.1 },
    ],
  },
  mark: {
    label: "Marcar herói (1º clique)",
    options: [
      { label: "Selecionar herói (Deadlock)", files: ["game:ui/hero_select"], loudness: 0.022, pitch: 0.02 },
      { label: "Carta deslizando", files: ["card-slide-1", "card-slide-2"], volume: 0.6, pitch: 0.06 },
      { label: "Seleção", files: ["select-001"], volume: 0.5, pitch: 0.05 },
      { label: "Clique", files: ["click-001"], volume: 0.5, pitch: 0.05 },
    ],
  },
  ban: {
    label: "Herói banido",
    options: [
      { label: "Soco pesado", files: ["impactpunch-heavy-000"], volume: 0.7, pitch: 0.05 },
      { label: "Prato pesado", files: ["impactplate-heavy-000"], volume: 0.6, pitch: 0.05 },
      { label: "Madeira pesada", files: ["impactwood-heavy-000"], volume: 0.7, pitch: 0.05 },
    ],
  },
  pick: {
    label: "Herói escolhido",
    options: [
      { label: "Confirmar herói (Deadlock)", files: ["game:ui/hero_select_play"], loudness: 0.03, pitch: 0.02 },
      { label: "Carta na mesa", files: ["card-place-1", "card-place-2", "card-place-3"], volume: 0.75, pitch: 0.06 },
      { label: "Ficha na mesa", files: ["chip-lay-1", "chip-lay-2"], volume: 0.7, pitch: 0.06 },
      { label: "Pilha de fichas", files: ["chips-stack-1"], volume: 0.6, pitch: 0.05 },
    ],
  },
  playerPick: {
    label: "Jogador escolhido para um time",
    options: [
      { label: "Ficha na mesa", files: ["chip-lay-1", "chip-lay-2"], volume: 0.7, pitch: 0.06 },
      { label: "Carta na mesa", files: ["card-place-1", "card-place-2"], volume: 0.7, pitch: 0.06 },
      { label: "Carta empurrada", files: ["card-shove-1"], volume: 0.7, pitch: 0.05 },
    ],
  },
  undo: {
    label: "Escolha desfeita",
    options: [
      { label: "Carta voltando", files: ["card-slide-2"], volume: 0.6, pitch: 0.05 },
      { label: "Soltar", files: ["drop-001"], volume: 0.5, pitch: 0.05 },
    ],
  },
  yourTurn: {
    label: "Começou a sua vez",
    options: [
      { label: "Confirmação", files: ["confirmation-001"], volume: 0.6 },
      { label: "Bong", files: ["bong-001"], volume: 0.6 },
      { label: "Vidro", files: ["glass-001"], volume: 0.6 },
    ],
  },
  tick: {
    label: "Últimos 5 segundos do turno",
    options: [
      { label: "Contagem (Deadlock)", files: ["game:ui/ui_pause_count"], loudness: 0.02, maxDuration: 0.35 },
      { label: "Tique gerado", synth: blip(1400, 0.035), volume: 0.35 },
      { label: "Tique gravado", files: ["tick-001"], volume: 0.5 },
      { label: "Tique gravado 2", files: ["tick-002"], volume: 0.5 },
    ],
  },
  coinSpin: {
    label: "Moeda girando",
    options: [
      { label: "Metal tilintando", sequence: "rattle-metal", volume: 0.5 },
      { label: "Lata tilintando", sequence: "rattle-tin", volume: 0.45 },
      { label: "Anel metálico gerado", synth: metallicRing, volume: 0.25 },
    ],
  },
  coinLand: {
    label: "Moeda caindo",
    options: [
      { label: "Metal", files: ["impactmetal-medium-000"], volume: 0.7 },
      { label: "Sino", files: ["impactbell-heavy-000"], volume: 0.5 },
      { label: "Fichas batendo", files: ["chips-collide-1", "chips-collide-2"], volume: 0.7 },
    ],
  },
  chat: {
    label: "Mensagem nova no chat",
    options: [
      { label: "Pluck", files: ["pluck-001"], volume: 0.45, pitch: 0.04 },
      { label: "Pluck 2", files: ["pluck-002"], volume: 0.45, pitch: 0.04 },
      { label: "Gota", files: ["drop-001"], volume: 0.45, pitch: 0.04 },
    ],
  },
  draftStart: {
    label: "Início do draft (marcante)",
    options: [
      { label: "Início de partida (Deadlock)", files: ["game:ui/match_start_01"], loudness: 0.04, maxDuration: 4 },
      {
        label: "Gongo e cartas",
        layers: [
          { synth: boom, at: 0, volume: 0.9 },
          { file: "impactbell-heavy-000", at: 0 },
          { file: "cards-pack-open-1", at: 0.3, volume: 0.9 },
        ],
        volume: 0.75,
      },
      {
        label: "Embaralhar e abrir o leque",
        layers: [
          { file: "card-shuffle", at: 0 },
          { file: "card-fan-1", at: 0.5 },
        ],
        volume: 0.8,
      },
      { label: "Fanfarra de abertura", layers: [{ synth: boom, at: 0 }, { synth: fanfare([392, 523, 659, 784]), at: 0.05 }], volume: 0.45 },
    ],
  },
  finished: {
    label: "Fim do draft (marcante)",
    options: [
      { label: "Partida concluída (Deadlock)", files: ["game:ui/ui_show_category_match_complete"], loudness: 0.04, maxDuration: 2.5 },
      { label: "Calibração concluída (Deadlock)", files: ["game:ui/ui_calibration_complete_01"], loudness: 0.035, maxDuration: 3 },
      { label: "Vitória (Deadlock)", files: ["game:music/music_stinger_game_over_win"], loudness: 0.04, maxDuration: 4.5 },
      {
        label: "Fanfarra e fichas",
        layers: [
          { synth: fanfare([523, 659, 784, 1047]), at: 0, volume: 0.6 },
          { file: "chips-stack-6", at: 0.4 },
        ],
        volume: 0.75,
      },
      {
        label: "Sino e confirmação",
        layers: [
          { file: "impactbell-heavy-000", at: 0, volume: 0.8 },
          { file: "confirmation-002", at: 0.25 },
        ],
        volume: 0.7,
      },
      { label: "Fichas empilhando", files: ["chips-stack-6"], volume: 0.7 },
    ],
  },
  error: {
    label: "Ação recusada (erro)",
    options: [
      { label: "Erro", files: ["error-004"], volume: 0.45 },
      { label: "Zumbido gerado", synth: buzz, volume: 0.25 },
    ],
  },
  click: {
    label: "Botões (copiar link, iniciar…)",
    options: [
      { label: "Clique", files: ["click-001"], volume: 0.45, pitch: 0.05 },
      { label: "Switch", files: ["switch22"], volume: 0.4, pitch: 0.08 },
    ],
  },
}

// ---------- Preferências (por navegador) ----------

// voice: falas dos heróis ao serem escolhidos; voiceVolume: volume delas (sobre o volume geral).
type Settings = { muted: boolean; volume: number; voice: boolean; voiceVolume: number; choice: Partial<Record<SoundEvent, number>> }
const STORAGE_KEY = "tatinuanga:sons"
const DEFAULTS: Settings = { muted: false, volume: 0.6, voice: true, voiceVolume: 0.6, choice: {} }

let settings: Settings = DEFAULTS
let loaded = false
const listeners = new Set<() => void>()
function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") }
  } catch {}
}

function save(next: Partial<Settings>) {
  load()
  settings = { ...settings, ...next }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
  listeners.forEach((l) => l())
}

export const setMuted = (muted: boolean) => save({ muted })
export const setVolume = (volume: number) => save({ volume: Math.min(1, Math.max(0, volume)) })
export const setVoice = (voice: boolean) => save({ voice })
export const setVoiceVolume = (voiceVolume: number) => save({ voiceVolume: Math.min(1, Math.max(0, voiceVolume)) })
export const chooseSound = (event: SoundEvent, option: number) => save({ choice: { ...settings.choice, [event]: option } })

export function useSoundSettings() {
  return useSyncExternalStore(subscribe, () => (load(), settings), () => DEFAULTS)
}

// ---------- Tocar ----------

let ctx: AudioContext | null = null
// Cada som carregado guarda o volume médio (RMS), para igualar os do jogo ao volume-alvo.
const buffers = new Map<string, Promise<{ buf: AudioBuffer; rms: number } | null>>()
const lastPlayed = new Map<SoundEvent, number>()
// Intervalo mínimo entre dois toques do mesmo som (passar o mouse rápido não vira metralhadora).
const MIN_GAP_MS: Partial<Record<SoundEvent, number>> = { hover: 45, chat: 150, tick: 200 }

function audio() {
  if (typeof window === "undefined") return null
  ctx ??= new AudioContext()
  // O navegador só libera som depois de uma interação; o primeiro clique ou tecla destrava.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {})
  return ctx
}

if (typeof window !== "undefined") {
  const unlock = () => audio()
  window.addEventListener("pointerdown", unlock, { once: true })
  window.addEventListener("keydown", unlock, { once: true })
}

function soundUrl(name: string) {
  if (name.startsWith("game:")) return `${GAME_SOUNDS}${name.slice(5)}.mp3`
  if (name.startsWith("http")) return name
  return `/sounds/${name}.ogg`
}

function rmsOf(buf: AudioBuffer) {
  const data = buf.getChannelData(0)
  let sum = 0
  for (let i = 0; i < data.length; i += 2) sum += data[i] * data[i]
  return Math.sqrt(sum / Math.max(1, data.length / 2)) || 0.0001
}

function buffer(name: string) {
  const ac = audio()
  if (!ac) return Promise.resolve(null)
  let entry = buffers.get(name)
  if (!entry) {
    entry = fetch(soundUrl(name))
      .then((r) => r.arrayBuffer())
      .then((data) => ac.decodeAudioData(data))
      .then((buf) => ({ buf, rms: rmsOf(buf) }))
      .catch(() => null)
    buffers.set(name, entry)
  }
  return entry
}

// Pré-carrega os sons escolhidos (chamado ao entrar na sala), para o primeiro toque sair na hora.
export function preloadSounds() {
  load()
  for (const event of Object.keys(SOUNDS) as SoundEvent[]) {
    const option = pick(event)
    option.files?.forEach((f) => void buffer(f))
    option.layers?.forEach((l) => l.file && void buffer(l.file))
    if (option.sequence) (option.sequence === "rattle-metal" ? metal : ["impacttin-medium-000"]).forEach((f) => void buffer(f))
  }
}

function pick(event: SoundEvent, index?: number) {
  const { options } = SOUNDS[event]
  return options[index ?? settings.choice[event] ?? 0] ?? options[0]
}

const vary = (amount = 0) => 1 + (Math.random() * 2 - 1) * amount

type PlayOptions = { loudness?: number; maxDuration?: number }

async function playFile(name: string, volume: number, rate: number, when = 0, opts: PlayOptions = {}) {
  const ac = audio()
  const entry = await buffer(name)
  if (!ac || !entry) return null
  const source = ac.createBufferSource()
  source.buffer = entry.buf
  source.playbackRate.value = rate
  const gain = ac.createGain()
  // Com volume-alvo, o arquivo é ajustado para chegar nele (limite de 12x para sons quase mudos).
  const level = opts.loudness ? volume * Math.min(12, opts.loudness / entry.rms) : volume
  const start = ac.currentTime + when
  gain.gain.setValueAtTime(level, start)
  source.connect(gain).connect(ac.destination)
  source.start(start)
  if (opts.maxDuration && entry.buf.duration > opts.maxDuration) {
    const fade = Math.min(1.5, opts.maxDuration / 2)
    gain.gain.setValueAtTime(level, start + opts.maxDuration - fade)
    gain.gain.linearRampToValueAtTime(0.0001, start + opts.maxDuration)
    source.stop(start + opts.maxDuration)
  }
  return source
}

// Toca o som de um momento. index: força uma opção (página de teste de sons).
export function playSound(event: SoundEvent, index?: number) {
  load()
  if (settings.muted && index === undefined) return
  const now = performance.now()
  if (now - (lastPlayed.get(event) ?? 0) < (MIN_GAP_MS[event] ?? 0)) return
  lastPlayed.set(event, now)

  const option = pick(event, index)
  const volume = (option.loudness ? 1 : (option.volume ?? 0.5)) * settings.volume * vary(0.08)
  const ac = audio()
  if (!ac || volume <= 0) return

  if (option.layers) {
    for (const layer of option.layers) {
      const layerVolume = volume * (layer.volume ?? 1)
      if (layer.file) void playFile(layer.file, layerVolume, vary(0.02), layer.at)
      if (layer.synth) {
        const gain = ac.createGain()
        gain.gain.value = layerVolume
        gain.connect(ac.destination)
        layer.synth(ac, gain, ac.currentTime + layer.at)
      }
    }
  } else if (option.synth) {
    const gain = ac.createGain()
    gain.gain.value = volume
    gain.connect(ac.destination)
    option.synth(ac, gain, ac.currentTime)
  } else if (option.sequence) {
    // Moeda girando: tilintares cada vez mais rápidos e baixos, como uma moeda assentando na mesa.
    const files = option.sequence === "rattle-metal" ? metal : ["impacttin-medium-000"]
    // O intervalo encolhe até um mínimo (sem o mínimo, a soma nunca chega a 1,45 s e o laço não acaba).
    let t = 0
    let gap = 0.17
    for (let i = 0; i < 40 && t < 1.45; i++) {
      void playFile(files[i % files.length], volume * (1 - t / 2), vary(0.1) * (1 + t * 0.25), t)
      t += gap
      gap = Math.max(gap * 0.86, 0.04)
    }
  } else if (option.files) {
    const file = option.files[Math.floor(Math.random() * option.files.length)]
    void playFile(file, volume, vary(option.pitch ?? 0), 0, { loudness: option.loudness, maxDuration: option.maxDuration })
  }
}

// ---------- Falas dos heróis ----------

// Volume-alvo das falas: abaixo dos efeitos, para não pegar ninguém de surpresa.
// Pick e ban no mesmo nível: as duas são falas.
const VOICE_LOUDNESS = { pick: 0.045, ban: 0.045 }
let currentVoice: AudioBufferSourceNode | null = null

// Toca uma das falas de seleção do herói (sorteada). Uma por vez: a nova corta a anterior.
// force: toca mesmo com as falas desligadas (botão de teste da página de sons).
export async function playVoice(
  urls: string[],
  { delay = 0, force = false, kind = "pick" }: { delay?: number; force?: boolean; kind?: keyof typeof VOICE_LOUDNESS } = {},
) {
  load()
  if (urls.length === 0 || (!force && (settings.muted || !settings.voice))) return
  const url = urls[Math.floor(Math.random() * urls.length)]
  const volume = settings.volume * settings.voiceVolume
  if (volume <= 0) return
  currentVoice?.stop()
  const source = await playFile(url, volume, 1, delay, { loudness: VOICE_LOUDNESS[kind] })
  if (!source) return
  currentVoice = source
  source.onended = () => {
    if (currentVoice === source) currentVoice = null
  }
}

// ---------- Sons gerados ----------

function blip(freq: number, length: number): Synth {
  return (ac, out, start) => {
    const osc = ac.createOscillator()
    const env = ac.createGain()
    osc.frequency.value = freq * vary(0.02)
    env.gain.setValueAtTime(1, start)
    env.gain.exponentialRampToValueAtTime(0.001, start + length)
    osc.connect(env).connect(out)
    osc.start(start)
    osc.stop(start + length)
  }
}

// Vários parciais "desafinados" entre si dão o timbre de metal; o tremolo acelera como a moeda girando.
function metallicRing(ac: AudioContext, out: AudioNode, t0: number) {
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(1, t0 + 0.05)
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 1.5)
  const tremolo = ac.createGain()
  const lfo = ac.createOscillator()
  const depth = ac.createGain()
  lfo.frequency.setValueAtTime(6, t0)
  lfo.frequency.exponentialRampToValueAtTime(40, t0 + 1.5)
  depth.gain.value = 0.5
  lfo.connect(depth).connect(tremolo.gain)
  for (const f of [2380, 3610, 5230, 7140]) {
    const osc = ac.createOscillator()
    osc.frequency.value = f * vary(0.01)
    osc.connect(tremolo)
    osc.start(t0)
    osc.stop(t0 + 1.5)
  }
  tremolo.connect(env).connect(out)
  lfo.start(t0)
  lfo.stop(t0 + 1.5)
}

function buzz(ac: AudioContext, out: AudioNode, start: number) {
  const osc = ac.createOscillator()
  const env = ac.createGain()
  osc.type = "square"
  osc.frequency.value = 110
  env.gain.setValueAtTime(0.6, start)
  env.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
  osc.connect(env).connect(out)
  osc.start(start)
  osc.stop(start + 0.25)
}

// Boom grave: um seno que despenca de tom, como um bumbo.
function boom(ac: AudioContext, out: AudioNode, start: number) {
  const osc = ac.createOscillator()
  const env = ac.createGain()
  osc.frequency.setValueAtTime(90, start)
  osc.frequency.exponentialRampToValueAtTime(38, start + 0.6)
  env.gain.setValueAtTime(1, start)
  env.gain.exponentialRampToValueAtTime(0.001, start + 0.8)
  osc.connect(env).connect(out)
  osc.start(start)
  osc.stop(start + 0.8)
}

// Fanfarra curta: arpejo subindo e a última nota sustentada.
function fanfare(notes: number[]): Synth {
  return (ac, out, start) => {
    notes.forEach((freq, i) => {
      const at = start + i * 0.11
      const last = i === notes.length - 1
      const length = last ? 0.9 : 0.3
      const osc = ac.createOscillator()
      const env = ac.createGain()
      osc.type = "triangle"
      osc.frequency.value = freq
      env.gain.setValueAtTime(0.0001, at)
      env.gain.exponentialRampToValueAtTime(1, at + 0.015)
      env.gain.exponentialRampToValueAtTime(0.001, at + length)
      osc.connect(env).connect(out)
      osc.start(at)
      osc.stop(at + length)
    })
  }
}
