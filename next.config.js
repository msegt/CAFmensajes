/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ─── Cloudflare Pages deployment ──────────────────────────────────────────
  // Uncomment this block when deploying to Cloudflare Pages via @cloudflare/next-on-pages
  // experimental: {
  //   runtime: 'edge',
  // },

  // ─── GitHub Pages static export ───────────────────────────────────────────
  // Uncomment ONLY if exporting to GitHub Pages (removes API routes — use
  // the Cloudflare Worker in /worker/index.ts as your backend instead).
  // output: 'export',
  // basePath: '/YOUR_REPO_NAME',   // ← replace with your GitHub repo name
  // assetPrefix: '/YOUR_REPO_NAME/',
};

module.exports = nextConfig;
