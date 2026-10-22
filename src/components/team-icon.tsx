import { TEAM_COLORS, TEAM_NAMES, type Team } from "@/lib/draft-rules"

// Símbolos dos times no jogo (Deadlock API), pintados na cor de cada time via máscara.
const ICONS: Record<Team, string> = {
  a: "https://assets-bucket.deadlock-api.com/assets-api-res/images/hud/core/icon_team1.webp",
  b: "https://assets-bucket.deadlock-api.com/assets-api-res/images/hud/core/icon_team2.webp",
}

export function TeamIcon({ team, className = "h-4 w-4", color }: { team: Team; className?: string; color?: string }) {
  const mask = `url(${ICONS[team]}) center / contain no-repeat`
  return (
    <span
      role="img"
      aria-label={TEAM_NAMES[team]}
      className={`inline-block shrink-0 ${className}`}
      style={{ background: color ?? TEAM_COLORS[team], mask, WebkitMask: mask }}
    />
  )
}
