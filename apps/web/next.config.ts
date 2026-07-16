import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: ["@xuanshu/agent", "@xuanshu/domain"],
};

export default nextConfig;
