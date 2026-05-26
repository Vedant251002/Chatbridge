/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // bullmq + ioredis + @prisma/client must run on the Node runtime,
  // never the edge runtime, and shouldn't be bundled by Next.
  // pdf-parse + pdfjs-dist + @napi-rs/canvas are optional native deps loaded
  // at runtime; marking them external prevents Next from trying to bundle them.
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "@prisma/client",
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
  // Next traces only statically-imported files. pdf-parse does a try/catch
  // require() of @napi-rs/canvas which the tracer can't see, so we tell it
  // explicitly to copy the canvas package + its native binary into the
  // standalone output.
  outputFileTracingIncludes: {
    "/api/knowledge/upload": [
      "../node_modules/@napi-rs/canvas/**/*",
      "../node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "../node_modules/@napi-rs/canvas-linux-x64-musl/**/*",
    ],
  },
};

export default nextConfig;
