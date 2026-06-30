const distDir = process.env.NEXT_DIST_DIR || ".next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  typedRoutes: false,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: [
          "**/.dataless-backups/**",
          "**/.git.dataless-backup-*/**",
          "**/deploy/**",
          "**/dist/**",
          "**/experiments/**",
          "**/node_modules 2/**",
          "**/node_modules 3/**",
          "**/platform/**",
        ],
      };
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  // Type safety is enforced by the partitioned `npm run typecheck:changed`
  // release gate; Next's monolithic checker stalls on this workspace.
  typescript: {
    ignoreBuildErrors: true
  }
};

export default nextConfig;
