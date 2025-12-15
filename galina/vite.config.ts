import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0', // Используем 0.0.0.0 для доступности из всех интерфейсов (Safari работает с localhost/127.0.0.1)
    port: 3000,
    strictPort: false, // Разрешаем использовать другой порт, если 3000 занят
    open: false, // Не открываем браузер автоматически
    hmr: false, // Полностью отключаем HMR для Safari совместимости
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0'],
    // Дополнительные настройки для Safari совместимости
    watch: {
      usePolling: true, // Включаем polling для Safari
    },
    // CORS настройки для Safari
    cors: {
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: false,
    },
    // Headers для Safari совместимости
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer',
      'Access-Control-Allow-Credentials': 'false',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
    // Прокси для локальной разработки - переключаемся между локальным и продакшен backend
    proxy: process.env.USE_LOCAL_BACKEND === 'true' ? {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // Настройки для Safari совместимости
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('🔗 Proxy error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Удаляем проблемные заголовки для Safari
            proxyReq.removeHeader('Origin');
            proxyReq.removeHeader('Referer');
            // Добавляем правильный Origin
            proxyReq.setHeader('Origin', 'http://localhost:3000');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Добавляем CORS headers в ответ
            proxyRes.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000';
            proxyRes.headers['Access-Control-Allow-Credentials'] = 'false';
          });
        },
      },
    } : {
      '/api': {
        target: 'https://lawyer.windexs.ru:1042',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // Настройки для Safari совместимости
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('🔗 Proxy error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.removeHeader('Origin');
            proxyReq.setHeader('Origin', 'http://localhost:3000');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000';
          });
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger()
  ].filter(Boolean),

  // Add safari-test.html to build
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        safari: './safari-test.html'
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
