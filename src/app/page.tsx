import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { StartDraftButton } from "@/components/start-draft-button"
import { DraftPreview } from "@/components/draft-preview"
import { HeroMarquee } from "@/components/hero-marquee"
import { getHeroes } from "@/lib/heroes"

const steps = [
  {
    title: "Configure",
    description: "Defina o nome dos times, o formato de picks e bans e o tempo de cada turno.",
  },
  {
    title: "Compartilhe",
    description: "Envie o link de cada time para os capitães e o link de espectador para a stream.",
  },
  {
    title: "Draft ao vivo",
    description: "Os times escolhem e banem heróis em turnos, com atualização instantânea para todos.",
  },
]

// Sequência de turnos: "a#" = ban do time A, "b2" = 2 picks do time B, etc.
const formats = [
  { name: "Padrão", detail: "4 bans", order: "a#-b#-a1-b2-a2-b1-b#-a#-b1-a2-b2-a1" },
  { name: "Mini torneio", detail: "2 bans no início", order: "a#-b#-a1-b2-a2-b1-b1-a2-b2-a1" },
  { name: "Watchparty", detail: "Sem bans", order: "a1-b2-a2-b1-b1-a2-b2-a1" },
  { name: "Simples", detail: "Um de cada vez", order: "a1-b1-a1-b1-a1-b1-a1-b1-a1-b1-a1-b1" },
  { name: "Avançado", detail: "Picks duplos", order: "a1-b2-a2-b2-a2-b1-a1-b1" },
]

const features = [
  {
    title: "Tempo real",
    description: "Times e espectadores veem cada pick e ban no mesmo instante.",
  },
  {
    title: "Timer por turno",
    description: "Contagem regressiva configurável, com escolha automática quando o tempo acaba.",
  },
  {
    title: "Modo stream",
    description: "Tela de espectador pronta para overlay no OBS, sem expor os links dos times.",
  },
]

export const revalidate = 86400

export default async function HomePage() {
  const heroes = await getHeroes()

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-grid pointer-events-none absolute inset-0" />
          <div
            className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--team-a)" }}
          />
          <div
            className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--team-b)" }}
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div className="space-y-7 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Draft competitivo para Deadlock
              </span>
              <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                Pick & ban
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, var(--team-a), var(--team-b))" }}
                >
                  sem complicação
                </span>
              </h1>
              <p className="mx-auto max-w-lg text-lg text-muted-foreground lg:mx-0">
                Organize o draft da sua partida competitiva em segundos. Dois capitães, um link para
                cada time e uma tela pronta para a transmissão.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <StartDraftButton />
                <a
                  href="#como-funciona"
                  className="inline-flex h-13 items-center px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Como funciona →
                </a>
              </div>
              <dl className="flex justify-center gap-8 pt-2 lg:justify-start">
                <Stat value={heroes.length > 0 ? String(heroes.length) : "40+"} label="heróis" />
                <Stat value={String(formats.length)} label="formatos" />
                <Stat value="6v6" label="por partida" />
              </dl>
            </div>

            <DraftPreview heroes={heroes} />
          </div>
        </section>

        <HeroMarquee heroes={heroes} />

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="Passo a passo" title="Como funciona" />
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-xl border border-border bg-card/50 p-6">
                <span className="font-display text-4xl font-bold text-muted-foreground/40">
                  0{i + 1}
                </span>
                <h3 className="mt-3 font-bold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Formatos */}
        <section id="formatos" className="scroll-mt-14 border-y border-border/60 bg-card/30">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionTitle eyebrow="Do amistoso ao campeonato" title="Formatos de draft" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {formats.map((f) => (
                <div key={f.name} className="rounded-xl border border-border bg-background/60 p-5">
                  <h3 className="font-bold">{f.name}</h3>
                  <p className="text-sm text-muted-foreground">{f.detail}</p>
                  <FormatOrder order={f.order} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="Recursos" title="Feito para competição" />
          <div className="grid gap-4 sm:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card/50 p-6">
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-10 text-center sm:p-14">
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{ background: "linear-gradient(135deg, var(--team-a), transparent 45%, transparent 55%, var(--team-b))" }}
            />
            <div className="relative space-y-6">
              <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
                Pronto para o próximo confronto?
              </h2>
              <p className="mx-auto max-w-md text-muted-foreground">
                Crie um draft agora e mande os links para os capitães.
              </p>
              <StartDraftButton />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl font-bold">{value}</dd>
    </div>
  )
}

function FormatOrder({ order }: { order: string }) {
  return (
    <div className="mt-4 flex flex-wrap gap-1" aria-label={`Ordem: ${order}`}>
      {order.split("-").map((turn, i) => {
        const color = turn[0] === "a" ? "var(--team-a)" : "var(--team-b)"
        const isBan = turn[1] === "#"
        return (
          <span
            key={i}
            className="flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold"
            style={
              isBan
                ? { border: `1px solid ${color}`, color }
                : { background: color, color: "#0b0d12" }
            }
          >
            {isBan ? "B" : turn.slice(1)}
          </span>
        )
      })}
    </div>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">{title}</h2>
    </div>
  )
}
