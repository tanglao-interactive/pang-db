import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typedRoutes: false,
  serverExternalPackages: ["knex", "pg"],
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
