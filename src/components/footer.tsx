import { site } from "@/lib/site"

export function Footer() {
  return (
    <footer className="border-t border-border/60 py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <span>© {new Date().getFullYear()} {site.name}</span>
        <span>
          Não afiliado à Valve. Deadlock é marca registrada da Valve Corporation.
        </span>
        <a
          href="https://github.com/deadlockprobr/draft"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-foreground"
        >
          Inspirado em deadlockprobr/draft
        </a>
      </div>
    </footer>
  )
}
