import Link from "next/link"

// Botão de voltar, com seta e texto (o mesmo em todas as páginas).
export function BackLink({ href = "/", label = "Voltar", className = "" }: { href?: string; label?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted hover:text-foreground ${className}`}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
      {label}
    </Link>
  )
}
