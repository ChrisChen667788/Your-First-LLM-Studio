const distDir = process.env.NEXT_DIST_DIR || ".next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
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
