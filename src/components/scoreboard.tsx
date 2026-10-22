import Link from "next/link"
import { TEAM_COLORS, TEAM_NAMES, type ResultPlayer, type Team } from "@/lib/draft-rules"
import { formatSouls, playerName } from "@/lib/format"
import type { Hero } from "@/lib/heroes"
import type { ItemSlot, ShopItem } from "@/lib/items"

const SLOT_COLORS: Record<ItemSlot, string> = { weapon: "#d08c3a", vitality: "#6fa83f", spirit: "#9b6ad6" }
const SLOT_ORDER: ItemSlot[] = ["weapon", "vitality", "spirit"]

// Placar de um time, no estilo da tela de fim de partida do jogo.
export function Scoreboard({
  team,
  players,
  winner,
  heroes,
  items,
  meId,
  captain,
}: {
  team: Team
  players: ResultPlayer[]
  winner: boolean
  heroes: Map<number, Hero>
  items: Map<number, ShopItem>
  meId: string
  // Draft da plataforma: o time aparece como "Time <capitão>" (com o lado do jogo entre parênteses).
  captain?: string
}) {
  const souls = players.reduce((sum, p) => sum + p.netWorth, 0)
  // Destaques do time (como no jogo): maior valor de cada coluna.
  const top = (key: keyof ResultPlayer) => Math.max(...players.map((p) => Number(p[key]) || 0))
  const best = { netWorth: top("netWorth"), damage: top("damage"), objDamage: top("objDamage"), healing: top("healing") }

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex items-center gap-3">
        <p className="font-display text-lg font-bold uppercase tracking-wide" style={{ color: TEAM_COLORS[team] }}>
          {captain ? `Time ${captain}` : TEAM_NAMES[team]}
          {captain && <span className="ml-2 font-sans text-xs font-semibold normal-case tracking-normal text-muted-foreground">({TEAM_NAMES[team]})</span>}
        </p>
        {winner && <span className="rounded bg-green-600/20 px-2 py-0.5 text-[11px] font-bold text-green-300">Vitória</span>}
        <span className="ml-auto text-xs text-muted-foreground">{formatSouls(souls)} almas</span>
      </div>
      <table className="w-full min-w-[860px] border-separate border-spacing-y-1 text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-2 font-semibold">Jogador</th>
            <th className="px-2 text-right font-semibold">Almas</th>
            <th className="px-1 text-center font-semibold" title="Abates">V</th>
            <th className="px-1 text-center font-semibold" title="Mortes">M</th>
            <th className="px-1 text-center font-semibold" title="Assistências">A</th>
            <th className="px-2 text-right font-semibold">Dano jog.</th>
            <th className="px-2 text-right font-semibold">Dano obj.</th>
            <th className="px-2 text-right font-semibold">Cura</th>
            <th className="px-2 font-semibold">Itens</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const hero = heroes.get(p.heroId)
            const build = p.items.map((id) => items.get(id)).filter((i): i is ShopItem => Boolean(i))
            const me = p.userId === meId
            return (
              <tr
                key={p.accountId}
                className="[&>td]:py-1.5 [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg"
                style={{ background: `color-mix(in oklab, ${TEAM_COLORS[team]} ${me ? 28 : 12}%, transparent)` }}
              >
                <td className="px-2">
                  <div className="flex items-center gap-2">
                    {hero && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hero.card} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover object-top" />
                    )}
                    <div className="min-w-0">
                      <p className={`flex items-center gap-1.5 truncate font-semibold ${p.userId ? "" : "text-foreground/80"}`}>
                        {p.accountId > 0 ? (
                          <Link href={`/jogador/${p.accountId}`} className="hover:underline">
                            {playerName(p)}
                          </Link>
                        ) : (
                          playerName(p)
                        )}
                        {p.mvpRank === 1 && <span className="rounded bg-yellow-500/25 px-1 text-[9px] font-black text-yellow-300">MVP</span>}
                        {p.mvpRank === 2 && <span className="rounded bg-zinc-400/20 px-1 text-[9px] font-black text-zinc-300">2º</span>}
                        {p.mvpRank === 3 && <span className="rounded bg-orange-700/25 px-1 text-[9px] font-black text-orange-300">3º</span>}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {hero?.name ?? "?"}
                        {p.level > 0 && ` · nível ${p.level}`}
                      </p>
                    </div>
                  </div>
                </td>
                <Num value={p.netWorth} highlight={p.netWorth === best.netWorth} />
                <td className="px-1 text-center font-mono font-bold tabular-nums">{p.kills}</td>
                <td className="px-1 text-center font-mono tabular-nums text-muted-foreground">{p.deaths}</td>
                <td className="px-1 text-center font-mono font-bold tabular-nums">{p.assists}</td>
                <Num value={p.damage} highlight={p.damage === best.damage} />
                <Num value={p.objDamage} highlight={p.objDamage === best.objDamage} />
                <Num value={p.healing} highlight={p.healing === best.healing} />
                <td className="px-2">
                  <div className="flex flex-wrap gap-0.5">
                    {SLOT_ORDER.flatMap((slot) => build.filter((i) => i.slot === slot)).map((item, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${item.id}-${i}`}
                        src={item.image}
                        alt={item.name}
                        title={item.name}
                        className="h-6 w-6 rounded-sm border-b-2 bg-black/40 object-contain p-0.5"
                        style={{ borderColor: SLOT_COLORS[item.slot] }}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Num({ value, highlight }: { value: number; highlight: boolean }) {
  return (
    <td className={`px-2 text-right font-mono tabular-nums ${highlight && value > 0 ? "font-bold text-yellow-300" : ""}`}>
      {formatSouls(value)}
    </td>
  )
}
