/** @type {import('next').NextConfig} */
const nextConfig = {
  // StrictMode is intentionally only enabled for production builds. In `next dev`,
  // StrictMode double-invokes renders, effects, and state updaters to surface effect
  // cleanup bugs — useful but it ~doubles commit-phase work per keystroke when the
  // DevId overlay is active. Production builds still flag those issues. Flip this
  // back to `true` if you need to debug a suspected double-invoke problem.
  reactStrictMode: process.env.NODE_ENV === "production",
  // Standalone output (task 44-33a): `next build` produces .next/standalone/server.js
  // that runs with bare `node server.js` — no `next start`, no global next CLI dep.
  // Required for the .planning/site/ double-click launcher in 44-33c. The
  // installer copies .next/standalone/ + .next/static/ + public/ into
  // <consumer>/.planning/site/ and the launcher boots `node server.js` from
  // there with PORT + HOSTNAME env. See references/installer-feature-flags.md.
  output: "standalone",
};

export default nextConfig;
