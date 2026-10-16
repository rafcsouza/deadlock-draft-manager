"use client"

import { useId, useState } from "react"

// Faixa com um resumo sempre visível e o conteúdo completo que abre/fecha com animação.
export function Collapsible({
  summary,
  children,
  className = "",
}: {
  summary: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <li className={`rounded-2xl border bg-card/80 transition-colors ${open ? "border-muted-foreground/40" : "border-border"} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <svg
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {/* Animação de altura: a grade vai de 0fr a 1fr. */}
      <div
        id={id}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={`space-y-4 px-4 pb-4 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} inert={!open}>
            {children}
          </div>
        </div>
      </div>
    </li>
  )
}
