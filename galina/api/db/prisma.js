// Prisma client configuration
const { PrismaClient } = require('@prisma/client');
const config = require('../config');

console.log('💾 API running with SQLite database');
console.log('📊 Database URL:', config.DATABASE_URL);

// Initialize Prisma Client (only if not standalone)
const prisma = config.STANDALONE_MODE === 'false' ? new PrismaClient() : null;

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(0);
});

module.exports = prisma;
