/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "assets-bucket.deadlock-api.com" }],
  },
}

export default nextConfig
