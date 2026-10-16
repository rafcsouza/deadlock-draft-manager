import Link from "next/link"
import { redirect } from "next/navigation"
import { ChangePasswordForm, EditProfileForm } from "@/components/profile-forms"
import { ThemedCard } from "@/components/themed-card"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { toSteam64 } from "@/lib/steam"

export const metadata = { title: "Editar perfil" }

export default async function EditProfilePage() {
  const user = await requireUser("/perfil")
  // Visitante não tem perfil para editar: oferece criar uma conta.
  if (user.isGuest) redirect("/cadastro")
  const row = db.prepare("SELECT steam_account_id FROM users WHERE id = ?").get(user.id) as { steam_account_id: number | null }
  const steamId = row.steam_account_id

  return (
    <ThemedCard>
      <div className="w-full space-y-1">
        <Link href="/" className="block text-left text-xs text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
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
