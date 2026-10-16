import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata = { title: "Novo Draft" }

// Placeholder: aqui ficará o formulário de criação do draft (times, formato, timer).
export default function NewDraftPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-display text-4xl font-bold uppercase">Novo Draft</h1>
          <p className="text-muted-foreground">
            A configuração do draft (times, formato e timer) será construída na próxima etapa.
          </p>
          <Link href="/" className="inline-block text-sm font-semibold text-muted-foreground hover:text-foreground">
            ← Voltar para a home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
