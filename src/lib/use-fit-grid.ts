"use client"

import { useLayoutEffect, useRef, useState } from "react"

export type FitGrid = { columns: number; width: number; height: number }

// Calcula colunas e tamanho dos cards para que `count` cards (proporção
// largura/altura `ratio`) caibam inteiros no elemento, sem rolagem,
// escolhendo o maior tamanho de card possível.
export function fitGrid(count: number, boxW: number, boxH: number, ratio: number, gap: number): FitGrid {
  let best: FitGrid = { columns: 1, width: 0, height: 0 }
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns)
    const byWidth = (boxW - gap * (columns - 1)) / columns
    const byHeight = ((boxH - gap * (rows - 1)) / rows) * ratio
    const width = Math.floor(Math.min(byWidth, byHeight))
    if (width > best.width) best = { columns, width, height: Math.floor(width / ratio) }
  }
  return best
}

export function useFitGrid<T extends HTMLElement>(count: number, ratio: number, gap: number) {
  const ref = useRef<T>(null)
  const [grid, setGrid] = useState<FitGrid | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const style = getComputedStyle(el)
      const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      setGrid(fitGrid(count, width, height, ratio, gap))
    }
    // Mede já na montagem: o ResizeObserver pode atrasar em abas em segundo plano.
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [count, ratio, gap])

  return { ref, grid }
}
