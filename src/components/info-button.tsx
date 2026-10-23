"use client"

import { useEffect, useId, useState } from "react"

// Botãozinho "i" que abre uma janela com explicações (o conteúdo vem pronto do servidor).
export function InfoButton({ title, label, children }: { title: string; label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title={title}
        aria-label={title}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current font-serif text-[11px] font-black italic">i</span>
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-2xl shadow-black/60"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ✕
            </button>
            <h2 id={titleId} className="pr-8 font-display text-xl font-bold uppercase tracking-wide text-foreground">
              {title}
            </h2>
            {children}
          </div>
        </div>
      )}
    </>
  )
}
