// Configuration and environment validation
require('dotenv').config({ path: './.env' });

// Generate JWT secret if missing (for production convenience)
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
  console.log('🔐 Generated JWT secret for production');
}

const config = {
  // Server configuration
  PORT: process.env.PORT || 1042,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL,
  AUTO_INIT_DB: process.env.AUTO_INIT_DB !== 'false',
  STANDALONE_MODE: process.env.STANDALONE_MODE || 'false',

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET,

  // OpenAI configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  // Proxy configuration
  PROXY_HOST: process.env.PROXY_HOST || '185.68.187.20',
  PROXY_PORT: process.env.PROXY_PORT || '8000',
  PROXY_USERNAME: process.env.PROXY_USERNAME || 'rBD9e6',
  PROXY_PASSWORD: process.env.PROXY_PASSWORD || 'jZdUnJ',

  // Validation
  validate() {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter(key => !this[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Optional but recommended
    if (!this.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set - demo mode will be used');
    }

    return this;
  }
};

// Validate and export
module.exports = config.validate();
