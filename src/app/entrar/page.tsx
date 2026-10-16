import { redirect } from "next/navigation"
import { SignInForm } from "@/components/auth-forms"
import { Logo } from "@/components/logo"
import { ThemedCard } from "@/components/themed-card"
import { getCurrentUser, safeNext } from "@/lib/auth"
import { site } from "@/lib/site"

export const metadata = { title: "Entrar" }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)
  if (await getCurrentUser()) redirect(next)

  return (
    <ThemedCard>
      <div className="space-y-3">
        <Logo className="mx-auto h-8 w-8" />
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{site.name}</h1>
        <p className="text-sm text-muted-foreground">Entre com seu perfil</p>
      </div>
      <SignInForm next={next} />
    </ThemedCard>
  )
}
