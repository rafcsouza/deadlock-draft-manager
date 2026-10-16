import Link from "next/link"
import { Logo } from "@/components/logo"
import { site } from "@/lib/site"

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <Logo />
          {site.name}
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <a href="/#como-funciona" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
            Como funciona
          </a>
          <a href="/#formatos" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
            Formatos
          </a>
          <Link
            href="/draft/novo"
            className="rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-bold text-background transition-opacity hover:opacity-90"
          >
            Iniciar Draft
          </Link>
        </div>
      </div>
    </nav>
  )
}
