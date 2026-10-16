import type { Hero } from "@/lib/heroes"

export function HeroMarquee({ heroes }: { heroes: Hero[] }) {
  if (heroes.length === 0) return null
  const loop = [...heroes, ...heroes]

  return (
    <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="animate-marquee flex w-max gap-3">
        {loop.map((h, i) => (
          <div
            key={i}
            className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border-b-2 bg-muted sm:h-32 sm:w-24"
            style={{ borderColor: h.color }}
            aria-hidden={i >= heroes.length}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={h.card} alt={i < heroes.length ? h.name : ""} loading="lazy" className="h-full w-full object-cover opacity-80" />
          </div>
        ))}
      </div>
    </div>
  )
}
