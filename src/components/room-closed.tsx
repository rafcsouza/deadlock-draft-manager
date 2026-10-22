import Link from "next/link"
import { ThemedCard } from "@/components/themed-card"

// Sala que o dono excluiu: o link não leva mais a lugar nenhum.
export function RoomClosed() {
  return (
    <ThemedCard>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Sala encerrada</h1>
        <p className="text-sm text-muted-foreground">O dono excluiu esta sala de draft.</p>
      </div>
      <Link
        href="/"
        className="bg-team-gradient flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg shadow-black/40"
      >
        Ir para a página inicial
      </Link>
    </ThemedCard>
  )
}
