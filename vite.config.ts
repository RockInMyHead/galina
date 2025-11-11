import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3001,
    hmr: {
      // Настройки для WebSocket HMR
      port: 3001,
      host: 'localhost',
      protocol: 'ws',
    },
    // Дополнительные настройки для стабильности WebSocket
    watch: {
      usePolling: false,
    },
    // Прокси для API запросов в режиме разработки
    proxy: {
      '/chat': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        secure: false,
      },
      '/tts': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        secure: false,
      },
      '/stt': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        secure: false,
      },
      '/user': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        secure: false,
      },
      '/files': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        secure: false,
      },
      '/search-court-cases': {
        target: 'http://localhost:1041',
        changeOrigin: true,
        secure: false,
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
