/** @type {import('next').NextConfig} */
const nextConfig = {
  // StrictMode is intentionally only enabled for production builds. In `next dev`,
  // StrictMode double-invokes renders, effects, and state updaters to surface effect
  // cleanup bugs — useful but it ~doubles commit-phase work per keystroke when the
  // DevId overlay is active. Production builds still flag those issues. Flip this
  // back to `true` if you need to debug a suspected double-invoke problem.
  reactStrictMode: process.env.NODE_ENV === "production",
};

export default nextConfig;
