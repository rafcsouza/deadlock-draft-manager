// Leitura local (OCR, sem internet) do placar de fim de partida do Deadlock.
// O placar tem sempre o mesmo layout: cada célula é recortada na posição conhecida
// (referência 1920×1080, escalada para o tamanho do print) e lida separadamente.
// Cada célula numérica é lida de vários jeitos e o valor mais votado vence.
import path from "node:path"
import sharp from "sharp"
import { createWorker, PSM, type Worker } from "tesseract.js"

export type OcrPlayer = {
  name: string
  hero: string
  souls: number | null
  kills: number | null
  deaths: number | null
  assists: number | null
  damage: number | null
  objDamage: number | null
  healing: number | null
}

export type OcrScoreboard = {
  matchId: number | null
  durationS: number | null
  winner: "a" | "b" | null
  teams: { a: OcrPlayer[]; b: OcrPlayer[] }
}

// Posições no placar em 1920×1080 (centro vertical de cada linha e faixas horizontais das colunas).
const ROWS = { a: [160, 216, 272, 328, 384, 440], b: [588, 644, 700, 756, 812, 868] }
const NAME_X: [number, number] = [262, 450]
const STAT_COLUMNS = {
  souls: [548, 640],
  kills: [660, 701],
  deaths: [701, 740],
  assists: [740, 781],
  damage: [803, 890],
  objDamage: [891, 978],
  healing: [980, 1066],
} as const
const MATCH_ID_BOX = [1560, 44, 1895, 66] as const
const DURATION_BOX = [1682, 104, 1748, 129] as const
const WIN_BADGE = { a: [362, 102, 480, 128], b: [352, 527, 470, 552] } as const

type Image = { raw: Buffer; width: number; height: number; sx: number; sy: number }
type Mode = "white" | "red"

let workerPromise: Promise<Worker> | null = null
let currentChars: string | null = null
let currentPsm: PSM | null = null

function getWorker() {
  if (!workerPromise) {
    // Dados do idioma instalados pelo npm (@tesseract.js-data/eng): nada é baixado da internet.
    // Caminho a partir da raiz do projeto (dentro do bundle do Next, require.resolve aponta para um caminho virtual).
    const langPath = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int")
    workerPromise = createWorker("eng", 1, {
      langPath,
      cacheMethod: "none",
      gzip: true,
      errorHandler: () => resetWorker(),
    }).then(async (w) => {
      await w.setParameters({ user_defined_dpi: "300", debug_file: "/dev/null" })
      return w
    })
    workerPromise.catch(() => resetWorker())
  }
  return workerPromise
}

function resetWorker() {
  const old = workerPromise
  workerPromise = null
  currentChars = null
  currentPsm = null
  old?.then((w) => w.terminate()).catch(() => {})
}

const TIMEOUT_MS = 90_000

// Uma leitura por vez: o worker é compartilhado e os parâmetros mudam entre as leituras.
let queue: Promise<unknown> = Promise.resolve()
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => {})
  return run
}

async function read(buf: Buffer, chars: string, psm: PSM) {
  const worker = await getWorker()
  if (chars !== currentChars || psm !== currentPsm) {
    await worker.setParameters({ tessedit_char_whitelist: chars, tessedit_pageseg_mode: psm })
    currentChars = chars
    currentPsm = psm
  }
  return (await worker.recognize(buf)).data.text.trim()
}

// Recorta uma célula e a deixa em preto sobre branco, com limiar adaptado ao próprio recorte.
// "white": texto claro (usa o menor canal, ignora fundos coloridos dos destaques);
// "red": números vermelhos sobre os destaques em forma de estrela.
async function crop(img: Image, box: readonly number[], mode: Mode, scale: number, level = 0.45) {
  const [x0, y0, x1, y1] = box
  const left = Math.round(x0 * img.sx)
  const top = Math.round(y0 * img.sy)
  const w = Math.max(1, Math.round((x1 - x0) * img.sx))
  const h = Math.max(1, Math.round((y1 - y0) * img.sy))
  const vals = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((top + y) * img.width + (left + x)) * 3
      const r = img.raw[i], g = img.raw[i + 1], b = img.raw[i + 2]
      vals[y * w + x] = mode === "white" ? Math.min(r, g, b) : Math.max(0, r - Math.max(g, b))
    }
  }
  const sorted = Array.from(vals).sort((p, q) => p - q)
  const bg = sorted[Math.floor(sorted.length * 0.5)]
  const fg = sorted[Math.floor(sorted.length * 0.99)]
  const thr = bg + (fg - bg) * level
  const out = Buffer.alloc(w * h)
  for (let i = 0; i < vals.length; i++) out[i] = fg - bg > 25 && vals[i] > thr ? 0 : 255
  return sharp(out, { raw: { width: w, height: h, channels: 1 } })
    .resize({ width: w * scale, kernel: "lanczos3" })
    .threshold(128)
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: "#fff" })
    .png()
    .toBuffer()
}

// "68 mil" / "68k" → 68000; "4,5 mil" / "4.5k" → 4500; "806" → 806; "nil"/"il" (mil mal lido) também.
export function parseStat(text: string): number | null {
  const t = text.toLowerCase().replace(/\s+/g, " ")
  const m = t.match(/(\d+)(?:[.,](\d))?/)
  if (!m) return null
  const value = Number(m[1]) + (m[2] ? Number(m[2]) / 10 : 0)
  const thousands = /\d\s*(k|m|n|i|l)/.test(t)
  return Math.round(thousands ? value * 1000 : value)
}

function mostVoted(values: (number | null)[]): number | null {
  const counts = new Map<number, number>()
  for (const v of values) if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: number | null = null
  let bestCount = 0
  for (const v of values) {
    if (v === null) continue
    const c = counts.get(v) ?? 0
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  }
  return best
}

// Lê uma célula de vários jeitos e devolve o valor mais votado.
async function readNumber(img: Image, box: readonly number[], parse: (s: string) => number | null) {
  const votes: (number | null)[] = []
  for (const mode of ["white", "red"] as Mode[]) {
    // Variações de tamanho, limiar e modo de leitura (o "voto" de cada uma).
    for (const [psm, scale, level] of [
      [PSM.SINGLE_LINE, 5, 0.45],
      [PSM.SINGLE_LINE, 8, 0.45],
      [PSM.SINGLE_WORD, 6, 0.45],
      [PSM.SINGLE_LINE, 5, 0.3],
      [PSM.SINGLE_LINE, 8, 0.3],
      [PSM.SINGLE_LINE, 5, 0.6],
      [PSM.SINGLE_WORD, 10, 0.6],
    ] as [PSM, number, number][]) {
      votes.push(parse(await read(await crop(img, box, mode, scale, level), "", psm)))
    }
    // Números vermelhos só aparecem nos destaques; se a leitura em branco já achou algo, basta.
    if (votes.some((v) => v !== null)) break
  }
  return mostVoted(votes)
}

async function readText(img: Image, box: readonly number[]) {
  return (await read(await crop(img, box, "white", 4), "", PSM.SINGLE_LINE)).replace(/[|]+$/, "").trim()
}

const thousandsIfSmall = (v: number | null) => (v !== null && v < 1000 ? v * 1000 : v)

const parseInteger = (s: string) => {
  const m = s.match(/\d+/)
  return m ? Number(m[0]) : null
}

const parseMatchId = (s: string) => {
  const m = s.replace(/\s/g, "").match(/\d{7,12}/)
  return m ? Number(m[0]) : null
}

const parseDuration = (s: string) => {
  const m = s.match(/(\d{1,3})\s*[:.]\s*(\d{2})/)
  return m && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null
}

export async function readScoreboard(image: Buffer): Promise<OcrScoreboard> {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const img: Image = { raw: data, width: info.width, height: info.height, sx: info.width / 1920, sy: info.height / 1080 }

  const work = exclusive(async (): Promise<OcrScoreboard> => {
    const winnerText = {
      a: (await readText(img, WIN_BADGE.a)).toLowerCase(),
      b: (await readText(img, WIN_BADGE.b)).toLowerCase(),
    }
    const won = (t: string) => /vit|vict|ria|ious/.test(t)

    const teams = { a: [] as OcrPlayer[], b: [] as OcrPlayer[] }
    for (const team of ["a", "b"] as const) {
      for (const c of ROWS[team]) {
        const name = await readText(img, [NAME_X[0], c - 21, NAME_X[1], c - 3])
        const hero = await readText(img, [NAME_X[0], c - 3, NAME_X[1], c + 16])
        if (!name && !hero) continue
        const stat = (col: keyof typeof STAT_COLUMNS, parse = parseStat) =>
          readNumber(img, [STAT_COLUMNS[col][0], c - 14, STAT_COLUMNS[col][1], c + 14], parse)
        teams[team].push({
          name,
          hero,
          // Almas nunca ficam abaixo de mil: "25" sem unidade é o "k" que não foi lido.
          souls: thousandsIfSmall(await stat("souls")),
          kills: await stat("kills", parseInteger),
          deaths: await stat("deaths", parseInteger),
          assists: await stat("assists", parseInteger),
          damage: await stat("damage"),
          objDamage: await stat("objDamage"),
          healing: await stat("healing"),
        })
      }
    }

    return {
      matchId: await readNumber(img, MATCH_ID_BOX, parseMatchId),
      durationS: await readNumber(img, DURATION_BOX, parseDuration),
      winner: won(winnerText.a) ? "a" : won(winnerText.b) ? "b" : null,
      teams,
    }
  })

  // Se o OCR travar, a leitura falha com uma mensagem em vez de ficar esperando para sempre.
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      resetWorker()
      reject(new Error("A leitura do print demorou demais. Tente de novo."))
    }, TIMEOUT_MS)
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

// Encerra o leitor de OCR (usado em scripts; no servidor ele fica aberto para os próximos prints).
export async function closeOcr() {
  if (!workerPromise) return
  const worker = await workerPromise
  workerPromise = null
  currentChars = null
  currentPsm = null
  await worker.terminate()
}
