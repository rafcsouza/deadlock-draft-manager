import { requireUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { randomBytes } from "node:crypto"

// Cada acesso cria uma sala nova, então a página não pode ser estática.
export const dynamic = "force-dynamic"

export default async function NewDraftPage() {
  await requireUser("/draft/novo")
  const code = randomBytes(4).toString("hex")
  redirect(`/draft/${code}`)
}
