/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Supabase Storage public buckets (ajusta el host a tu proyecto)
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  // Incluye la plantilla HTML de /misredes en el bundle de su función (Vercel).
  outputFileTracingIncludes: {
    "/misredes": ["./src/app/misredes/misredes.html"],
  },
};

export default nextConfig;
