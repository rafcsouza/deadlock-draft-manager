import { unstable_cache } from "next/cache"

const HEROES_API_URL =
  process.env.HEROES_API_URL ?? "https://api.deadlock-api.com/v1/assets/heroes"

export type Hero = {
  id: number
  name: string
  card: string
  /** Retrato com vida baixa, usado quando o herói é banido. */
  critical: string
  /** Retrato de sequência de abates ("on fire"), usado quando o herói é escolhido. */
  gloat: string
  color: string
}

type ApiHero = {
  id: number
  name: string
  player_selectable: boolean
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
        }
      })
      .filter((h) => h.card)
  } catch {
    return []
  }
}

// A resposta completa da API passa de 2 MB (limite do cache do Next),
// então cacheamos só a lista já filtrada, por 1 hora (heróis novos aparecem rápido).
export const getHeroes = unstable_cache(fetchHeroes, ["heroes-v3"], { revalidate: 3600 })
