"use client"

import Link from "next/link"
import { useState } from "react"
import { TEAM_COLORS, TEAM_NAMES, type MatchResultView, type ResultPlayer, type RoomAction, type Team } from "@/lib/draft-rules"
import { formatDuration, formatSouls, playerName } from "@/lib/format"
import type { Hero } from "@/lib/heroes"

// Etapa depois do draft: informar o ID da partida, conferir os stats e confirmar.
export function MatchResultPanel({
  result,
  fetching,
  savedDraftId,
  canManage,
  heroes,
  send,
}: {
  result: MatchResultView | null
  fetching: boolean
  savedDraftId: string | null
  canManage: boolean
  heroes: Map<number, Hero>
  send: (action: RoomAction) => void
}) {
  const [matchId, setMatchId] = useState("")

  if (savedDraftId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="font-display text-2xl font-bold uppercase tracking-wide">Partida salva no histórico</p>
        <p className="font-mono text-sm text-muted-foreground">#{savedDraftId}</p>
        <Link href="/historico" className="rounded-full border border-border bg-muted px-5 py-2 text-sm font-semibold hover:border-muted-foreground">
          Ver histórico
        </Link>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-1">
          <p className="font-display text-2xl font-bold uppercase tracking-wide">Resultado da partida</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Depois de jogar, informe o ID da partida (aparece no fim do jogo e no histórico de partidas do Deadlock)
            para buscar os stats. A partida só entra no histórico depois da confirmação.
          </p>
        </div>
        {canManage ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (matchId.trim()) send({ type: "submitMatch", matchId: matchId.trim() })
            }}
            className="flex w-full max-w-sm gap-2"
          >
            <input
              value={matchId}
              onChange={(e) => setMatchId(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="ID da partida"
              aria-label="ID da partida"
              disabled={fetching}
              className="min-w-0 flex-1 rounded-lg border border-border bg-muted/60 px-3 py-2.5 font-mono text-sm outline-none focus:border-muted-foreground/60"
            />
            <button
              type="submit"
              disabled={fetching || !matchId}
              className="shrink-0 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-60 bg-team-gradient"
            >
              {fetching ? "Buscando..." : "Buscar stats"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            {fetching ? "Buscando a partida..." : "Aguardando o anfitrião ou um capitão informar o ID da partida."}
          </p>
        )}
      </div>
    )
  }

  const mvp = result.players.find((p) => p.mvpRank === 1)
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="font-display text-xl font-bold uppercase tracking-wide">
          <span style={{ color: TEAM_COLORS[result.winner] }}>{TEAM_NAMES[result.winner]}</span> venceu
        </p>
        <span className="text-xs text-muted-foreground">
          Partida <span className="font-mono">{result.matchId}</span> · {formatDuration(result.durationS)}
          {mvp && <> · MVP: {playerName(mvp)}</>}
        </span>
      </div>

      {result.heroMatches < 12 && (
        <p className="rounded-lg border border-yellow-600/40 bg-yellow-600/10 px-3 py-2 text-xs text-yellow-200">
          Só {result.heroMatches} de 12 heróis dessa partida batem com o draft. Confira se o ID está certo.
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto md:grid-cols-2">
        {(["a", "b"] as const).map((team) => (
          <StatsTable
            key={team}
            team={team}
            players={result.players.filter((p) => p.team === team)}
            winner={result.winner === team}
            heroes={heroes}
          />
        ))}
      </div>

      {canManage ? (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => send({ type: "discardResult" })}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Usar outro ID
          </button>
          <button
            onClick={() => send({ type: "confirmResult" })}
            className="rounded-lg px-5 py-2 text-sm font-bold text-white bg-team-gradient"
          >
            Confirmar e salvar no histórico
          </button>
        </div>
      ) : (
        <p className="text-right text-xs text-muted-foreground">Aguardando o anfitrião ou um capitão confirmar.</p>
      )}
    </div>
  )
}

function StatsTable({
  team,
  players,
  winner,
  heroes,
}: {
  team: Team
  players: ResultPlayer[]
  winner: boolean
  heroes: Map<number, Hero>
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: TEAM_COLORS[team] }}>
        {TEAM_NAMES[team]}
        {winner && <span className="rounded bg-green-600/20 px-1.5 py-0.5 text-[10px] text-green-300">Vitória</span>}
      </p>
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="pb-1 font-semibold">Jogador</th>
            <th className="pb-1 text-center font-semibold">K/D/A</th>
            <th className="pb-1 text-right font-semibold">Almas</th>
            <th className="pb-1 text-right font-semibold">Dano</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const hero = heroes.get(p.heroId)
            return (
              <tr key={p.accountId} className="border-t border-border/60">
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    {hero && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hero.card} alt={hero.name} title={hero.name} className="h-7 w-7 shrink-0 rounded hero-face" />
                    )}
                    <span className={`truncate ${p.userId ? "font-semibold" : "text-muted-foreground"}`}>{playerName(p)}</span>
                    {p.mvpRank === 1 && <span className="shrink-0 rounded bg-yellow-500/20 px-1 text-[9px] font-black text-yellow-300">MVP</span>}
                  </div>
                </td>
                <td className="py-1.5 text-center font-mono tabular-nums">
                  {p.kills}/{p.deaths}/{p.assists}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">{formatSouls(p.netWorth)}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">{formatSouls(p.damage)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
