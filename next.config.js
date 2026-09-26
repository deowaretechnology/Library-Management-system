/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false, // don't advertise the framework/version
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
  async headers() {
    return [
      {
        // Everything except the embedded Studio, which needs its own relaxed rules
        // (it loads Sanity's own frames/scripts and manages its own CSP).
        source: "/((?!studio).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera=(self) — the QR scanner (Quick Issue, Return Book, etc.) needs camera
          // access on this origin; mic/geolocation stay fully blocked, unused by the app.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          // Modern equivalent of X-Frame-Options (clickjacking), plus: never talk to this site
          // over plain HTTP again, and don't let other sites read our pages cross-origin.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // The Studio manages its own script CSP, but it must still not be embeddable by other
        // sites (it had NO headers at all, and ships the raw-GROQ Vision tool).
        source: "/studio/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
