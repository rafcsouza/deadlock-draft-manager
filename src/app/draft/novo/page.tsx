import { redirect } from "next/navigation"
import { randomBytes } from "node:crypto"

// Cada acesso cria uma sala nova, então a página não pode ser estática.
export const dynamic = "force-dynamic"

export default function NewDraftPage() {
  const code = randomBytes(4).toString("hex")
  redirect(`/draft/${code}`)
}
