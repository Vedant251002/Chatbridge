/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // bullmq + ioredis + @prisma/client must run on the Node runtime,
  // never the edge runtime, and shouldn't be bundled by Next.
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "@prisma/client",
    "pdf-parse",
    "pdfjs-dist",
  ],
};

export default nextConfig;
