import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  /** Electron から 127.0.0.1 で dev を開くときの HMR 用 */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["pdfjs-dist"],
  turbopack: {
    root: resolve(import.meta.dirname!),
  },
};

export default nextConfig;
