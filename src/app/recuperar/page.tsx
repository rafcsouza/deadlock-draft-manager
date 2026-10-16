import { redirect } from "next/navigation"
import { RecoverForm } from "@/components/auth-forms"
import { ThemedCard } from "@/components/themed-card"
import { getCurrentUser } from "@/lib/auth"

export const metadata = { title: "Recuperar senha" }

export default async function RecoverPage() {
  if (await getCurrentUser()) redirect("/")

  return (
    <ThemedCard>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">Responda à sua pergunta de segurança para criar uma nova senha.</p>
      </div>
      <RecoverForm />
    </ThemedCard>
  )
}
