import Link from "next/link"
import { ChangePasswordForm, EditProfileForm, GuestNameForm } from "@/components/profile-forms"
import { ThemedCard } from "@/components/themed-card"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { BackLink } from "@/components/back-link"
import { toSteam64 } from "@/lib/steam"

export const metadata = { title: "Editar perfil" }

export default async function EditProfilePage() {
  const user = await requireUser("/perfil")
  if (user.isGuest) return <GuestProfile username={user.username} />
  const row = db.prepare("SELECT steam_account_id FROM users WHERE id = ?").get(user.id) as { steam_account_id: number | null }
  const steamId = row.steam_account_id

  return (
    <ThemedCard>
      <div className="w-full space-y-1">
        <div className="text-left">
          <BackLink />
        </div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Editar perfil</h1>
        {steamId !== null && (
          <Link href={`/jogador/${steamId}`} className="text-xs text-muted-foreground underline hover:text-foreground">
            Ver meus stats
          </Link>
        )}
      </div>

      <EditProfileForm
        username={user.username}
        avatar={user.avatar}
        steam64={steamId !== null ? toSteam64(steamId) : null}
      />

      <div className="w-full border-t border-border pt-6">
        <h2 className="mb-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Trocar senha</h2>
        <ChangePasswordForm />
      </div>
    </ThemedCard>
  )
}

// Visitante: troca só o nome; o resto do perfil (avatar, SteamID, senha) vem com uma conta.
function GuestProfile({ username }: { username: string }) {
  return (
    <ThemedCard>
      <div className="w-full space-y-1">
        <div className="text-left">
          <BackLink />
        </div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Seu nome</h1>
        <p className="text-xs text-muted-foreground">É o nome que aparece para os outros nas salas de draft.</p>
      </div>

      <GuestNameForm username={username} />

      <p className="w-full border-t border-border pt-5 text-xs text-muted-foreground">
        Quer avatar, SteamID e stats no leaderboard?{" "}
        <Link href="/cadastro" className="font-semibold text-foreground hover:underline">
          Crie uma conta
        </Link>
      </p>
    </ThemedCard>
  )
}
