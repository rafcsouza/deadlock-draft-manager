import { redirect } from "next/navigation"
import { SignUpForm } from "@/components/auth-forms"
import { ThemedCard } from "@/components/themed-card"
import { getCurrentUser, safeNext } from "@/lib/auth"

export const metadata = { title: "Criar perfil" }

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)
  if (await getCurrentUser()) redirect(next)

  return (
    <ThemedCard>
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Criar perfil</h1>
      <SignUpForm next={next} />
    </ThemedCard>
  )
}
