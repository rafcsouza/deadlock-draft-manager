"use client"

import { useEffect } from "react"
import { playSound } from "@/lib/sound"

// O que conta como "clicável" para o som de clique. Campos de texto ficam de fora.
const CLICKABLE = 'button, a[href], [role="button"], [role="tab"], summary, select, input[type="checkbox"], input[type="radio"]'

// Som de clique em tudo que é clicável no site, num único ouvinte global.
// Quem já tem som próprio (heróis, alto-falante, página de sons) marca data-sound="none".
export function ClickSounds() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest(CLICKABLE)
      if (!el || el.closest('[data-sound="none"]')) return
      if (el.matches(':disabled, [aria-disabled="true"]')) return
      playSound("click")
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])
  return null
}
