import Link from "next/link"

export function StartDraftButton({ size = "lg" }: { size?: "md" | "lg" }) {
  const sizing = size === "lg" ? "h-13 px-8 text-base" : "h-11 px-6 text-sm"
  return (
    <Link
      href="/draft/novo"
      className={`group relative inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white shadow-lg shadow-black/40 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${sizing}`}
      style={{ background: "linear-gradient(135deg, var(--team-a) 0%, var(--team-b) 100%)" }}
    >
      Criar Draft
      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  )
}
