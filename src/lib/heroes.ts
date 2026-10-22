import { unstable_cache } from "next/cache"

const HEROES_API_URL =
  process.env.HEROES_API_URL ?? "https://api.deadlock-api.com/v1/assets/heroes"
const SOUNDS_API_URL = "https://api.deadlock-api.com/v1/assets/sounds"

export type Hero = {
  id: number
  name: string
  card: string
  /** Retrato com vida baixa, usado quando o herói é banido. */
  critical: string
  /** Retrato de sequência de abates ("on fire"), usado quando o herói é escolhido. */
  gloat: string
  color: string
  /** Falas do herói (MP3 da API do Deadlock): pick = tom positivo, ban = tom negativo. */
  voices: { pick: string[]; ban: string[] }
}

type ApiHero = {
  id: number
  name: string
  class_name?: string
  player_selectable: boolean
  images: Record<string, string | undefined>
  colors?: { style_hex?: string }
}

// Busca os heróis jogáveis na API pública do Deadlock.
// Se a API falhar, a página continua funcionando sem as imagens.
async function fetchHeroes(): Promise<Hero[]> {
  try {
    const [res, voices] = await Promise.all([fetch(HEROES_API_URL, { cache: "no-store" }), getHeroVoices()])
    if (!res.ok) return []
    const data: ApiHero[] = await res.json()
    return data
      // Só `player_selectable`: a API às vezes mantém `in_development` em heróis
      // já jogáveis (ex.: Baba, out/2026), o que os escondia do draft.
      .filter((h) => h.player_selectable)
      .map((h) => {
        const card = h.images.icon_hero_card_webp ?? h.images.icon_hero_card ?? ""
        return {
          id: h.id,
          name: h.name,
          card,
          critical: h.images.hero_card_critical_webp ?? h.images.hero_card_critical ?? card,
          gloat: h.images.hero_card_gloat_webp ?? h.images.hero_card_gloat ?? card,
          color: h.colors?.style_hex ?? "#888888",
          // O codinome interno (ex.: Abrams = "atlas") é a pasta das falas.
          voices: voices[String(h.class_name ?? "").replace(/^hero_/, "")] ?? { pick: [], ban: [] },
        }
      })
      .filter((h) => h.card)
  } catch {
    return []
  }
}

// Categorias de fala usadas no draft: vo/<codinome>/.../<nome>_<categoria>_NN.
const VOICE_KINDS = {
  streak: /_killstreak_start_\d+$/,
  kill: /_kill_anyhero_\d+$/,
  select: /_select_\d+$/,
  unselect: /_unselect_\d+$/,
  sad: /_sad_\d+$/,
  death: /_pain_death_\d+$/,
}
type VoiceKind = keyof typeof VOICE_KINDS

// Falas de cada herói, por codinome. Pick: início de sequência de abates (tom positivo); sem essa,
// "matou um herói"; por último, a fala de seleção. Ban: a fala de quando o jogador desiste do herói
// na tela de seleção ("unselect"); sem essa, a fala triste; por último, o som de morte.
// Ficam de fora os "emote_" (grunhidos). A lista de sons da API tem 18 MB, então guardamos só esse
// resumo, por 1 dia.
async function fetchHeroVoices(): Promise<Record<string, Hero["voices"]>> {
  try {
    const res = await fetch(SOUNDS_API_URL, { cache: "no-store" })
    if (!res.ok) return {}
    const found: Record<string, Record<VoiceKind, string[]>> = {}
    ;(function walk(node: unknown, path: string) {
      if (typeof node === "string") {
        const [root, code] = path.split("/")
        if (root !== "vo" || !code || path.includes("emote_")) return
        for (const kind of Object.keys(VOICE_KINDS) as VoiceKind[]) {
          if (VOICE_KINDS[kind].test(path)) (found[code] ??= { streak: [], kill: [], select: [], unselect: [], sad: [], death: [] })[kind].push(node)
        }
      } else if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}/${key}` : key)
      }
    })(await res.json(), "")
    return Object.fromEntries(
      Object.entries(found).map(([code, v]) => [
        code,
        {
          pick: v.streak.length ? v.streak : v.kill.length ? v.kill : v.select,
          ban: v.unselect.length ? v.unselect : v.sad.length ? v.sad : v.death,
        },
      ]),
    )
  } catch {
    return {}
  }
}

const getHeroVoices = unstable_cache(fetchHeroVoices, ["hero-voices-v3"], { revalidate: 86400 })

// A resposta completa da API passa de 2 MB (limite do cache do Next),
// então cacheamos só a lista já filtrada, por 1 hora (heróis novos aparecem rápido).
export const getHeroes = unstable_cache(fetchHeroes, ["heroes-v6"], { revalidate: 3600 })
