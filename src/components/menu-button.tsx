import Link from "next/link"

type Props = {
  href: string
  children: React.ReactNode
  primary?: boolean
}

export function MenuButton({ href, children, primary }: Props) {
  return (
    <Link
      href={href}
      className={`group flex h-12 w-full items-center justify-between rounded-xl px-5 text-sm font-bold transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
        primary
          ? "bg-team-gradient text-white shadow-lg shadow-black/40"
          : "border border-border bg-muted/60 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
      }`}
    >
      {children}
      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  )
}
