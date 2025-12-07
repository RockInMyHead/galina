import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 3002,
    allowedHosts: ['lawyer.windexs.ru'],
    hmr: process.env.NODE_ENV === 'development' ? {
      // Настройки для WebSocket HMR - исправлено для Safari
      port: 3005, // Фиксированный порт для HMR (не конфликтует с API)
      host: 'lawyer.windexs.ru', // Используем lawyer.windexs.ru вместо 0.0.0.0
      protocol: 'ws',
    } : false, // Отключаем HMR для production
    // Дополнительные настройки для стабильности WebSocket
    watch: {
      usePolling: false,
    },
    // Прокси для локальной разработки
    proxy: {
      '/api': {
        // Ходим на боевой API напрямую, без localhost
        target: 'https://lawyer.windexs.ru:1042',
        changeOrigin: true,
        // Удаляем префикс /api, т.к. бэкенд слушает без него
        rewrite: (path) => path.replace(/^\/api/, ''),
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
