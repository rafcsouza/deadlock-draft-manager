"use client"

import { useState } from "react"
import { readPrintAction, savePrintAction } from "@/app/historico/actions"
import { TEAM_COLORS, TEAM_NAMES, type Team } from "@/lib/draft-rules"
import { formatDuration } from "@/lib/format"
import { PRINT_STATS, type PrintPlayer, type PrintReview } from "@/lib/print-types"

export type HeroOption = { id: number; name: string; card: string }

const STAT_LABELS: Record<(typeof PRINT_STATS)[number], string> = {
  souls: "Almas",
  kills: "V",
  deaths: "M",
  assists: "A",
  damage: "Dano jog.",
  objDamage: "Dano obj.",
  healing: "Cura",
}
const cellInput =
  "w-full rounded border border-border bg-muted/60 px-1.5 py-1 font-mono text-xs tabular-nums outline-none focus:border-muted-foreground/60"

const parseDuration = (s: string) => {
  const m = s.match(/^(\d{1,3}):(\d{2})$/)
  return m && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null
}

// Importação por print: envia a imagem, o servidor lê com OCR local e a pessoa revisa antes de salvar.
export function PrintImport({ heroes }: { heroes: HeroOption[] }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [review, setReview] = useState<PrintReview | null>(null)
  const [busy, setBusy] = useState<"read" | "save" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function read() {
    if (!file) return
    setBusy("read")
    setError(null)
    setOk(null)
    const data = new FormData()
    data.set("screenshot", file)
    const res = await readPrintAction(data)
    setBusy(null)
    if (res.error) setError(res.error)
    else if (res.review) setReview(res.review)
  }

  async function save() {
    if (!review) return
    setBusy("save")
    setError(null)
    const res = await savePrintAction(review)
    setBusy(null)
    if (res.error) return setError(res.error)
    setOk(res.ok ?? "Partida salva.")
    setReview(null)
    setFile(null)
    setPreview(null)
  }

  if (review) {
    return (
      <ReviewEditor
        review={review}
        heroes={heroes}
        preview={preview}
        onChange={setReview}
        onSave={save}
        onCancel={() => setReview(null)}
        saving={busy === "save"}
        error={error}
      />
    )
  }

  return (
    <div>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-3 hover:border-foreground">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Prévia do print" className="h-16 w-28 rounded object-cover" />
        ) : (
          <span className="flex h-16 w-28 items-center justify-center rounded bg-muted text-2xl text-muted-foreground">+</span>
        )}
        <span className="text-sm text-muted-foreground">
          {preview ? "Trocar print" : "Escolha o print do placar de fim de partida (tela cheia)"}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy !== null}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            setPreview(f ? URL.createObjectURL(f) : null)
            setError(null)
            setOk(null)
          }}
          className="hidden"
        />
      </label>
      <div className="mt-2 flex items-center gap-3">
        <p className="flex-1 text-[11px] text-muted-foreground">
          Lido no próprio servidor, sem custo e sem internet. Você revisa os valores antes de salvar. A partida fica
          pendente e fora do leaderboard até ser vinculada pela API.
        </p>
        <button onClick={read} disabled={!file || busy !== null} className="shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60 bg-team-gradient">
          {busy === "read" ? "Lendo print..." : "Ler print"}
        </button>
      </div>
      {busy === "read" && <p className="mt-2 text-xs text-muted-foreground">Isso leva uns 10 segundos.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      {ok && <p className="mt-2 text-xs text-green-300">{ok}</p>}
    </div>
  )
}

function ReviewEditor({
  review,
  heroes,
  preview,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
}: {
  review: PrintReview
  heroes: HeroOption[]
  preview: string | null
  onChange: (r: PrintReview) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
}) {
  const [durationText, setDurationText] = useState(review.durationS !== null ? formatDuration(review.durationS) : "")
  const heroById = new Map(heroes.map((h) => [h.id, h]))
  const sortedHeroes = [...heroes].sort((a, b) => a.name.localeCompare(b.name))

  const setPlayer = (team: Team, i: number, patch: Partial<PrintPlayer>) =>
    onChange({ ...review, teams: { ...review.teams, [team]: review.teams[team].map((p, j) => (j === i ? { ...p, ...patch } : p)) } })
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\D/g, "")))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Confira o que foi lido e corrija o que estiver errado.</p>
        <p className="text-xs text-muted-foreground">Campos em amarelo não foram lidos.</p>
      </div>

      {preview && (
        <details className="rounded-lg border border-border bg-background/40 p-2" open>
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Print enviado</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Print enviado" className="mt-2 w-full rounded" />
        </details>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-xs">
          <span className="block font-bold uppercase tracking-widest text-muted-foreground">ID da partida</span>
          <input
            value={review.matchId ?? ""}
            onChange={(e) => onChange({ ...review, matchId: num(e.target.value) })}
            inputMode="numeric"
            className={`${cellInput} w-36 ${review.matchId ? "" : "border-yellow-600/60"}`}
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-bold uppercase tracking-widest text-muted-foreground">Duração</span>
          <input
            value={durationText}
            onChange={(e) => {
              setDurationText(e.target.value)
              onChange({ ...review, durationS: parseDuration(e.target.value) })
            }}
            placeholder="mm:ss"
            className={`${cellInput} w-20 ${review.durationS !== null ? "" : "border-yellow-600/60"}`}
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-bold uppercase tracking-widest text-muted-foreground">Vencedor</span>
          <select
            value={review.winner ?? ""}
            onChange={(e) => onChange({ ...review, winner: (e.target.value || null) as Team | null })}
            className={`${cellInput} w-40 ${review.winner ? "" : "border-yellow-600/60"}`}
          >
            <option value="">—</option>
            <option value="a">{TEAM_NAMES.a}</option>
            <option value="b">{TEAM_NAMES.b}</option>
          </select>
        </label>
      </div>

      {(["a", "b"] as const).map((team) => (
        <div key={team} className="overflow-x-auto">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: TEAM_COLORS[team] }}>
            {TEAM_NAMES[team]}
          </p>
          <table className="w-full min-w-[820px] border-separate border-spacing-1 text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold">Jogador</th>
                <th className="text-left font-semibold">Herói</th>
                {PRINT_STATS.map((k) => (
                  <th key={k} className="text-left font-semibold">
                    {STAT_LABELS[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {review.teams[team].map((p, i) => {
                const hero = p.heroId ? heroById.get(p.heroId) : undefined
                return (
                  <tr key={i}>
                    <td className="w-44">
                      <input value={p.name} onChange={(e) => setPlayer(team, i, { name: e.target.value })} className={`${cellInput} font-sans`} />
                    </td>
                    <td className="w-40">
                      <div className="flex items-center gap-1.5">
                        {hero && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hero.card} alt="" className="h-6 w-6 shrink-0 rounded object-cover object-top" />
                        )}
                        <select
                          value={p.heroId ?? ""}
                          onChange={(e) => setPlayer(team, i, { heroId: e.target.value ? Number(e.target.value) : null })}
                          className={`${cellInput} font-sans ${p.heroId ? "" : "border-yellow-600/60"}`}
                        >
                          <option value="">—</option>
                          {sortedHeroes.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    {PRINT_STATS.map((k) => (
                      <td key={k} className={k === "kills" || k === "deaths" || k === "assists" ? "w-12" : "w-20"}>
                        <input
                          value={p[k] ?? ""}
                          onChange={(e) => setPlayer(team, i, { [k]: num(e.target.value) })}
                          inputMode="numeric"
                          aria-label={`${STAT_LABELS[k]} de ${p.name}`}
                          className={`${cellInput} ${p[k] === null ? "border-yellow-600/60" : ""}`}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={saving} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          Cancelar
        </button>
        <button onClick={onSave} disabled={saving} className="rounded-lg px-5 py-2 text-sm font-bold text-white disabled:opacity-60 bg-team-gradient">
          {saving ? "Salvando..." : "Salvar no histórico (pendente)"}
        </button>
      </div>
    </div>
  )
}
