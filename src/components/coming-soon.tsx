import Link from "next/link"

// Página provisória para telas que ainda serão construídas.
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-4xl font-bold uppercase">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <Link href="/" className="inline-block text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </div>
    </main>
  )
}
