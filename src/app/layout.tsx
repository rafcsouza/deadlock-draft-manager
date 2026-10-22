import type { Metadata } from "next"
import { Geist, Oswald } from "next/font/google"
import { ClickSounds } from "@/components/click-sounds"
import { site } from "@/lib/site"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" })

export const metadata: Metadata = {
  title: {
    default: `${site.name} - Pick & Ban para Deadlock`,
    template: `%s - ${site.name}`,
  },
  description: site.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${oswald.variable}`}>
      <body className="min-h-screen">
        <ClickSounds />
        {children}
      </body>
    </html>
  )
}
