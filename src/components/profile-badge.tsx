import Link from "next/link"
import { signOut } from "@/app/auth-actions"
import type { User } from "@/lib/auth"

// Perfil logado na home: quadrado que leva à edição do perfil, mais o botão de sair.
export function ProfileBadge({ user }: { user: User }) {
  return (
    <div className="flex w-full items-center gap-2 border-t border-border pt-5">
      <Link
        href="/perfil"
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-muted/40 p-2 pr-3 text-left transition-colors hover:border-muted-foreground/50 hover:bg-muted/70"
      >
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold uppercase">
            {user.username.slice(0, 2)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{user.username}</span>
          <span className="block text-[11px] text-muted-foreground group-hover:text-foreground">
            {user.isGuest ? "Visitante · Mudar nome" : "Editar perfil"}
          </span>
        </span>
        <svg className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </Link>
      <form action={signOut}>
        <button type="submit" className="rounded-lg px-2 py-2 text-xs text-muted-foreground hover:text-foreground">
          Sair
        </button>
      </form>
    </div>
  )
}
