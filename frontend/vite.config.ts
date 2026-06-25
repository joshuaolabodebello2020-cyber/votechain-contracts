import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SEC-011: Security headers for production deployment.
// Applied via the dev-server plugin so they are also present during `vite preview`.
// For a real CDN/hosting deployment, replicate these headers in the host config
// (e.g. Netlify _headers, Vercel headers, nginx add_header directives).
const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://soroban-testnet.stellar.org https://soroban-mainnet.stellar.org; frame-ancestors 'none';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // HSTS is only meaningful over HTTPS; set it here so preview/production picks it up.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'security-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          for (const [key, value] of Object.entries(securityHeaders)) {
            res.setHeader(key, value);
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          for (const [key, value] of Object.entries(securityHeaders)) {
            res.setHeader(key, value);
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 4173,
  },
  build: {
    // Enable source maps for production debugging (can be disabled for further optimization)
    sourcemap: false,
    // Minify CSS
    cssMinify: true,
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('i18next')) {
              return 'i18n-vendor';
            }
            if (id.includes('zustand')) {
              return 'zustand-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
