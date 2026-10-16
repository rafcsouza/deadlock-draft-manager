"use client"

import { useRef, useState } from "react"

const SIZE = 128
const MAX_FILE_BYTES = 20 * 1024 * 1024

// Recorta o centro da imagem em quadrado e reduz para SIZE×SIZE.
async function toAvatar(file: File) {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas")
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return canvas.toDataURL("image/webp", 0.85)
}

// Campo de avatar: o valor final vai num input escondido chamado "avatar".
// Com "initial" (edição de perfil): mostra o avatar atual e envia keepValue se a pessoa não mexer nele.
export function AvatarPicker({ initial, keepValue }: { initial?: string | null; keepValue?: string } = {}) {
  const [avatar, setAvatar] = useState("")
  const [keep, setKeep] = useState(Boolean(initial))
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setError("")
    if (!file.type.startsWith("image/")) return setError("Escolha um arquivo de imagem.")
    if (file.size > MAX_FILE_BYTES) return setError("Imagem muito grande (máximo 20 MB).")
    try {
      setAvatar(await toAvatar(file))
      setKeep(false)
    } catch {
      setError("Não foi possível ler essa imagem.")
    }
  }

  const shown = avatar || (keep ? initial : null)
  const value = avatar || (keep && keepValue ? keepValue : "")

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label={shown ? "Trocar avatar" : "Escolher avatar"}
        className="group relative h-20 w-20 overflow-hidden rounded-xl border border-dashed border-muted-foreground/50 bg-muted/40 transition-colors hover:border-foreground"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Seu avatar" className="h-full w-full object-cover" />
        ) : (
          <svg className="mx-auto h-7 w-7 text-muted-foreground group-hover:text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        )}
      </button>
      <div className="flex gap-3 text-xs">
        <button type="button" onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-foreground">
          {shown ? "Trocar avatar" : "Escolher avatar (opcional)"}
        </button>
        {shown && (
          <button
            type="button"
            onClick={() => {
              setAvatar("")
              setKeep(false)
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Remover
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <input type="hidden" name="avatar" value={value} />
    </div>
  )
}
