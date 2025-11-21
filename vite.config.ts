import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 0,
    hmr: {
      // Настройки для WebSocket HMR
      port: 0,
      host: 'localhost',
      protocol: 'ws',
    },
    // Дополнительные настройки для стабильности WebSocket
    watch: {
      usePolling: false,
    },
    // Прокси для API запросов в режиме разработки
    // Все запросы к /api/* будут проксироваться на localhost:3003
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false,
        // Не переписывать путь - оставлять /api префикс
      },
      // Прокси для внешних запросов через прокси-сервер 185.68.187.20:8000
      '/proxy': {
        target: 'http://185.68.187.20:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Proxy-Authorization', `Basic ${  Buffer.from('rBD9e6:jZdUnJ').toString('base64')}`);
            console.log('Proxy request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Proxy response:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
