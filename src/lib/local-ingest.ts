import "server-only"
import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

// Programa de ingest do Deadlock (deadlock-api-ingest) instalado no mesmo PC do site. Ele manda para a API
// os dados das partidas que estão no cache da Steam e na memória do jogo, mas sozinho só faz isso a cada
// ~5 minutos. Rodando com --once, a partida que acabou de terminar chega à API na hora (~30 s).
// Em outro servidor (sem o programa), não faz nada.
const INGEST_EXE =
  process.env.DEADLOCK_INGEST_PATH ??
  (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "deadlock-api-ingest", "deadlock-api-ingest.exe") : "")
const TIMEOUT_MS = 120_000

let running: Promise<boolean> | null = null

// Roda o ingest uma vez agora. Pedidos ao mesmo tempo esperam a mesma execução.
// Devolve false se o programa não existir neste PC ou se a execução falhar.
export function ingestNow(): Promise<boolean> {
  if (!INGEST_EXE || !existsSync(INGEST_EXE)) return Promise.resolve(false)
  running ??= new Promise<boolean>((resolve) => {
    execFile(INGEST_EXE, ["--once"], { timeout: TIMEOUT_MS, windowsHide: true }, (error) => {
      running = null
      resolve(!error)
    })
  })
  return running
}
