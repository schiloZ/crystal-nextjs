const isDev = process.env.NODE_ENV !== "production";

// Domaines autorisés pour les Server Actions, ex. "crystal.entreprise.ci,localhost:3000".
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Next.js injecte des scripts en ligne : 'unsafe-inline' reste nécessaire sans nonce.
// 'unsafe-eval' n'est autorisé qu'en développement (rechargement à chaud).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Ignoré par les navigateurs en HTTP ; actif dès que le site est servi en HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: { serverActions: { allowedOrigins } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
