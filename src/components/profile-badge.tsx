import { signOut } from "@/app/auth-actions"
import { PlayerAvatar } from "@/components/player-avatar"
import type { User } from "@/lib/auth"

// Perfil logado (avatar + nome) com o botão de sair.
export function ProfileBadge({ user }: { user: User }) {
  return (
    <div className="flex w-full items-center gap-3 border-t border-border pt-5">
      <PlayerAvatar player={{ id: String(user.id), name: user.username, avatar: user.avatar }} />
      <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{user.username}</span>
      <form action={signOut}>
        <button type="submit" className="text-xs text-muted-foreground hover:text-foreground">
          Sair
        </button>
      </form>
    </div>
  )
}
