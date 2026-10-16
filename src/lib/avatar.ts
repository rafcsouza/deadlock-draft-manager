// URL pública do avatar (servida por /api/avatar/[id]). O "v" muda quando a imagem
// muda, para o navegador não usar uma versão antiga do cache.
export function avatarUrl(userId: number, avatar: string | null) {
  if (!avatar) return null
  let hash = 0
  for (let i = 0; i < avatar.length; i += 7) hash = (hash * 31 + avatar.charCodeAt(i)) | 0
  return `/api/avatar/${userId}?v=${(hash >>> 0).toString(36)}`
}
