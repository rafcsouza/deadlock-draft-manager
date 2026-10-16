/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produção (next build / next start) em pasta própria, para não brigar com o next dev.
  distDir: process.env.NODE_ENV === "production" ? ".next-prod" : ".next",
  // OCR local: carregados direto do node_modules (o tesseract.js usa worker e arquivos próprios).
  serverExternalPackages: ["tesseract.js", "sharp"],
  // Prints do placar enviados ao servidor (o padrão é 1 MB).
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
}

export default nextConfig
