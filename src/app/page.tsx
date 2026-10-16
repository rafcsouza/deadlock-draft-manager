import { Logo } from "@/components/logo"
import { MenuButton } from "@/components/menu-button"
import { ProfileBadge } from "@/components/profile-badge"
import { ThemedCard } from "@/components/themed-card"
import { requireUser } from "@/lib/auth"
import { site } from "@/lib/site"

export default async function HomePage() {
  const user = await requireUser("/")

  return (
    <ThemedCard>
      <div className="space-y-3">
        <Logo className="mx-auto h-8 w-8" />
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{site.name}</h1>
        <p className="text-sm text-muted-foreground">Pick & ban para Deadlock</p>
      </div>

      <nav className="flex w-full flex-col gap-2.5">
        <MenuButton href="/draft/novo" primary>
          Criar Draft
        </MenuButton>
        <MenuButton href="/leaderboards">Leaderboards</MenuButton>
        <MenuButton href="/historico">Histórico de partidas</MenuButton>
      </nav>

      <ProfileBadge user={user} />
    </ThemedCard>
  )
}
