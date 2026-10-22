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
  /** Falas de seleção do herói (MP3 da API do Deadlock), tocadas quando ele é escolhido no draft. */
  voices: string[]
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
          voices: voices[String(h.class_name ?? "").replace(/^hero_/, "")] ?? [],
        }
      })
      .filter((h) => h.card)
  } catch {
    return []
  }
}

// Falas de seleção de cada herói, por codinome: vo/<codinome>/.../<nome>_select_NN (sem as "_unselect").
// A lista de sons da API tem 18 MB, então guardamos só esse resumo, por 1 dia.
async function fetchHeroVoices(): Promise<Record<string, string[]>> {
  try {
    const res = await fetch(SOUNDS_API_URL, { cache: "no-store" })
    if (!res.ok) return {}
    const voices: Record<string, string[]> = {}
    ;(function walk(node: unknown, path: string) {
      if (typeof node === "string") {
        const [root, code] = path.split("/")
        if (root === "vo" && code && /_select_\d+$/.test(path) && !/_unselect_/.test(path)) (voices[code] ??= []).push(node)
      } else if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}/${key}` : key)
      }
    })(await res.json(), "")
    return voices
  } catch {
    return {}
  }
}

const getHeroVoices = unstable_cache(fetchHeroVoices, ["hero-voices-v1"], { revalidate: 86400 })

// A resposta completa da API passa de 2 MB (limite do cache do Next),
// então cacheamos só a lista já filtrada, por 1 hora (heróis novos aparecem rápido).
export const getHeroes = unstable_cache(fetchHeroes, ["heroes-v4"], { revalidate: 3600 })
