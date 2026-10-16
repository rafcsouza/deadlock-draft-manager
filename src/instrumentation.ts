// Roda uma vez quando o servidor liga. O "if" com NEXT_RUNTIME deixa a importação de fora
// do pacote "edge" (onde os módulos do Node, como o banco, não existem).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutoVerify } = await import("@/lib/auto-verify")
    startAutoVerify()
  }
}
