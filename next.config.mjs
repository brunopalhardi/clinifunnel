/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async headers() {
    const noCacheHeaders = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
      { key: "CDN-Cache-Control", value: "no-store" },
      { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
    ];
    return [
      { source: "/api/:path*", headers: noCacheHeaders },
      { source: "/dashboard/:path*", headers: noCacheHeaders },
      { source: "/dashboard", headers: noCacheHeaders },
      { source: "/login", headers: noCacheHeaders },
      { source: "/", headers: noCacheHeaders },
    ];
  },
};

export default nextConfig;
