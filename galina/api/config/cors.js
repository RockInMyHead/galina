// CORS configuration
const corsAllowedOrigins = [
  // Публичный домен без локальных портов
  'https://lawyer.windexs.ru'
];

const corsOptions = {
  origin: corsAllowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = { corsAllowedOrigins, corsOptions };
