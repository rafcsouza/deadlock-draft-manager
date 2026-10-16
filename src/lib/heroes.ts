import { unstable_cache } from "next/cache"

const HEROES_API_URL =
  process.env.HEROES_API_URL ?? "https://api.deadlock-api.com/v1/assets/heroes"

export type Hero = {
  id: number
  name: string
  card: string
  color: string
}

type ApiHero = {
  id: number
  name: string
  player_selectable: boolean
  disabled: boolean
  in_development: boolean
  images: Record<string, string | undefined>
  colors?: { style_hex?: string }
}

// Busca os heróis jogáveis na API pública do Deadlock.
// Se a API falhar, a página continua funcionando sem as imagens.
async function fetchHeroes(): Promise<Hero[]> {
  try {
    const res = await fetch(HEROES_API_URL, { cache: "no-store" })
    if (!res.ok) return []
    const data: ApiHero[] = await res.json()
    return data
      .filter((h) => h.player_selectable && !h.disabled && !h.in_development)
      .map((h) => ({
        id: h.id,
        name: h.name,
        card: h.images.icon_hero_card_webp ?? h.images.icon_hero_card ?? "",
        color: h.colors?.style_hex ?? "#888888",
      }))
      .filter((h) => h.card)
  } catch {
    return []
  }
}

// A resposta completa da API passa de 2 MB (limite do cache do Next),
// então cacheamos só a lista já filtrada, por 1 dia.
export const getHeroes = unstable_cache(fetchHeroes, ["heroes"], { revalidate: 86400 })
