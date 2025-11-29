import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 3002,
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
    // Все запросы к /api/* будут проксироваться на localhost:3003 без префикса /api
    proxy: mode === 'development' ? {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''), // Убираем /api префикс
        configure: (proxy, options) => {
          // Логирование для отладки
          proxy.on('error', (err, req, res) => {
            console.log('API Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('API Proxy request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('API Proxy response:', proxyRes.statusCode, req.url);
          });
        },
      },
    } : {}, // В production режиме прокси не нужен - API на том же домене
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
