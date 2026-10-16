// Tela com o fundo temático (grade + brilho dos dois times) e um card central
// com a faixa dos times e ornamentos art déco. Usada na home e nas telas de conta.
export function ThemedCard({ children, square }: { children: React.ReactNode; square?: boolean }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-[85%] -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--team-a)" }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-[15%] -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--team-b)" }}
      />

      <div
        className={`relative flex w-full max-w-sm flex-col items-center justify-center gap-7 rounded-2xl border border-border bg-card/80 p-10 text-center shadow-2xl shadow-black/60 backdrop-blur ${
          square ? "aspect-square" : ""
        }`}
      >
        {/* Faixa dividida entre os dois times */}
        <div className="absolute inset-x-0 top-0 flex h-1 overflow-hidden rounded-t-2xl">
          <span className="flex-1 bg-team-a" />
          <span className="flex-1 bg-team-b" />
        </div>

        <Corner className="left-3 top-4" />
        <Corner className="right-3 top-4 -scale-x-100" />
        <Corner className="bottom-3 left-3 -scale-y-100" />
        <Corner className="bottom-3 right-3 -scale-100" />

        {children}
      </div>
    </main>
  )
}

// Ornamento de canto no estilo art déco do Deadlock.
function Corner({ className }: { className: string }) {
  return (
    <svg
      className={`pointer-events-none absolute h-6 w-6 text-muted-foreground/40 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <path d="M1 23V1h22" />
      <path d="M5 23V5h18" />
      <path d="M1 1l6 6" />
    </svg>
  )
}
