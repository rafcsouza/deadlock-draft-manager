import Link from "next/link"

export const metadata = { title: "Novo Draft" }

// Placeholder: aqui ficará o formulário de criação do draft (times, formato, timer).
export default function NewDraftPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-4xl font-bold uppercase">Novo Draft</h1>
        <p className="text-muted-foreground">
          A configuração do draft (times, formato e timer) será construída na próxima etapa.
        </p>
        <Link href="/" className="inline-block text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </div>
    </main>
  )
}
