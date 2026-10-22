import { redirect } from "next/navigation"
import { GuestForm, JoinRoomForms, SignInForm } from "@/components/auth-forms"
import { Logo } from "@/components/logo"
import { ThemedCard } from "@/components/themed-card"
import { getCurrentUser, safeNext } from "@/lib/auth"
import { ROOM_CODE_PATTERN } from "@/lib/draft-rules"
import { site } from "@/lib/site"

export const metadata = { title: "Entrar" }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)
  // Visitante pode abrir esta página para entrar com uma conta de verdade.
  const user = await getCurrentUser()
  if (user && !user.isGuest) redirect(next)

  // Veio pelo link de uma sala: a tela pede o nome primeiro (entra como visitante), com login como alternativa.
  const roomCode = next.startsWith("/draft/") ? next.slice("/draft/".length) : null
  if (roomCode && ROOM_CODE_PATTERN.test(roomCode) && !user) {
    return (
      <ThemedCard>
        <div className="space-y-3">
          <Logo className="mx-auto h-8 w-8" />
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Entrar na sala</h1>
          <p className="text-sm text-muted-foreground">Você foi chamado para um draft. Primeiro, diga seu nome.</p>
        </div>
        <JoinRoomForms next={next} />
      </ThemedCard>
    )
  }

  return (
    <ThemedCard>
      <div className="space-y-3">
        <Logo className="mx-auto h-8 w-8" />
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{site.name}</h1>
        <p className="text-sm text-muted-foreground">Entre com seu perfil</p>
      </div>
      <SignInForm next={next} />
      <GuestForm next={next} />
    </ThemedCard>
  )
}
