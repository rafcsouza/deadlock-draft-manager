/** @type {import('next').NextConfig} */
const nextConfig = {
  // OCR local: carregados direto do node_modules (o tesseract.js usa worker e arquivos próprios).
  serverExternalPackages: ["tesseract.js", "sharp"],
  // Prints do placar enviados ao servidor (o padrão é 1 MB).
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
}

export default nextConfig
