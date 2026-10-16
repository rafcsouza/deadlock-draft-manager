import "server-only"
import { unstable_cache } from "next/cache"

export type ItemSlot = "weapon" | "vitality" | "spirit"
export type ShopItem = { id: number; name: string; slot: ItemSlot; tier: number; image: string }

type ApiItem = {
  id: number
  name: string
  item_slot_type?: string
  item_tier?: number
  shop_image_webp?: string
  image_webp?: string
  shop_image?: string
  image?: string
}

// Catálogo de itens da loja (armas, vitalidade, espírito) da API do Deadlock.
async function fetchItems(): Promise<ShopItem[]> {
  try {
    const res = await fetch("https://api.deadlock-api.com/v1/assets/items/by-type/upgrade", { cache: "no-store" })
    if (!res.ok) return []
    const data: ApiItem[] = await res.json()
    return data
      .map((i) => ({
        id: i.id,
        name: i.name,
        slot: (i.item_slot_type ?? "weapon") as ItemSlot,
        tier: i.item_tier ?? 1,
        image: i.shop_image_webp ?? i.image_webp ?? i.shop_image ?? i.image ?? "",
      }))
      .filter((i) => i.image && ["weapon", "vitality", "spirit"].includes(i.slot))
  } catch {
    return []
  }
}

// A resposta completa passa de 2 MB (limite do cache do Next), então cacheamos a lista enxuta.
export const getItems = unstable_cache(fetchItems, ["items-v1"], { revalidate: 86400 })
