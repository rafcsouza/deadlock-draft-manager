import type { Hero } from "@/lib/heroes"

type Props = {
  hero?: Hero
  team?: "a" | "b"
  banned?: boolean
  className?: string
}

export function HeroCard({ hero, team, banned, className = "" }: Props) {
  const ring = team === "a" ? "var(--team-a)" : team === "b" ? "var(--team-b)" : "var(--border)"

  if (!hero) {
    return (
      <div
        className={`aspect-[3/4] rounded-lg border border-dashed border-border bg-muted/40 ${className}`}
      />
    )
  }

  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-lg border-b-2 bg-muted ${className}`}
      style={{ borderColor: ring }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero.card}
        alt={hero.name}
        loading="lazy"
        className={`h-full w-full object-cover ${banned ? "grayscale opacity-50" : ""}`}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1 pb-1 pt-4 text-center text-[10px] font-bold leading-tight text-white sm:text-[11px]">
        {hero.name}
      </div>
      {banned && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-white">
            BAN
          </span>
        </div>
      )}
    </div>
  )
}
