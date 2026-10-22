import Link from "next/link"

// Botão do menu da página inicial (o "Criar Draft" tem o seu, em home-rooms).
export function MenuButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex h-12 w-full items-center justify-between rounded-xl border border-border bg-muted/60 px-5 text-sm font-bold text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-muted-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      {children}
      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  )
}
