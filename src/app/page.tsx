import { Logo } from "@/components/logo"
import { MenuButton } from "@/components/menu-button"
import { site } from "@/lib/site"

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Fundo: grade sutil + brilho das cores dos dois times */}
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-[85%] -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--team-a)" }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-[15%] -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--team-b)" }}
      />

      <div className="relative flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-7 rounded-2xl border border-border bg-card/80 p-10 text-center shadow-2xl shadow-black/60 backdrop-blur">
        {/* Faixa dividida entre os dois times */}
        <div className="absolute inset-x-0 top-0 flex h-1 overflow-hidden rounded-t-2xl">
          <span className="flex-1 bg-team-a" />
          <span className="flex-1 bg-team-b" />
        </div>

        <Corner className="left-3 top-4" />
        <Corner className="right-3 top-4 -scale-x-100" />
        <Corner className="bottom-3 left-3 -scale-y-100" />
        <Corner className="bottom-3 right-3 -scale-100" />

        <div className="space-y-3">
          <Logo className="mx-auto h-8 w-8" />
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{site.name}</h1>
          <p className="text-sm text-muted-foreground">Pick & ban para Deadlock</p>
        </div>

        <nav className="flex w-full flex-col gap-2.5">
          <MenuButton href="/draft/novo" primary>
            Criar Draft
          </MenuButton>
          <MenuButton href="/leaderboards">Leaderboards</MenuButton>
          <MenuButton href="/historico">Histórico de partidas</MenuButton>
        </nav>
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
