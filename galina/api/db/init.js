// Database initialization and demo user setup
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const prisma = require('./prisma');
const config = require('../config');

// Initialize database schema automatically
async function initializeDatabase() {
  if (config.STANDALONE_MODE === 'true') {
    console.log('🏠 Skipping database initialization in standalone mode');
    return;
  }

  if (!config.AUTO_INIT_DB) {
    console.log('🔧 Auto-initialization disabled, skipping database setup');
    return;
  }

  try {
    console.log('🔧 Checking database schema...');

    // Check if database file exists first
    let dbPath = config.DATABASE_URL.replace('file:', '');
    if (!path.isAbsolute(dbPath)) {
      dbPath = path.resolve(process.cwd(), dbPath);
    }

    console.log('🔍 Checking database path:', dbPath);
    const dbExists = fs.existsSync(dbPath);

    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('📁 Created database directory:', dbDir);
    }

    if (!dbExists) {
      console.log('⚠️  Database file not found, creating schema...');

      // Use spawn instead of execSync for better control
      const child = spawn('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: config.DATABASE_URL },
        stdio: 'pipe'
      });

      return new Promise((resolve) => {
        child.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Database schema created successfully');
            resolve();
          } else {
            console.error('❌ Failed to create database schema (exit code:', code, ')');
            console.log('🔧 Please run: npm run db:push manually');
            resolve();
          }
        });

        child.on('error', (error) => {
          console.error('❌ Failed to start prisma command:', error.message);
          resolve();
        });
      });
    } else {
      console.log('✅ Database file exists');

      // Try to query a table to verify schema is valid
      try {
        const userCount = await prisma.user.count();
        console.log(`✅ Database schema valid (${userCount} users found)`);
      } catch (queryError) {
        console.log('⚠️  Database schema may be outdated, updating...');

        // Update schema if needed
        const { execSync } = require('child_process');
        try {
          execSync('npx prisma db push --accept-data-loss', {
            stdio: 'pipe',
            env: { ...process.env, DATABASE_URL: config.DATABASE_URL }
          });
          console.log('✅ Database schema updated successfully');
        } catch (pushError) {
          console.error('❌ Failed to update database schema:', pushError.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
  }
}

// Initialize demo user on startup
async function initializeDemoUser() {
  if (config.STANDALONE_MODE === 'true') {
    console.log('🏠 Skipping demo user initialization in standalone mode');
    return;
  }

  try {
    console.log('👤 Checking demo user...');

    const existingUser = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!existingUser) {
      console.log('👤 Creating demo user...');
      const hashedPassword = await bcrypt.hash('demo123', 10);
      const demoUser = await prisma.user.create({
        data: {
          email: 'demo@galina.ai',
          name: 'Demo User',
          password: hashedPassword,
        },
      });

      // Create initial balance
      await prisma.userBalance.create({
        data: {
          userId: demoUser.id,
          amount: 1500, // Initial balance from BALANCE_CONFIG
        },
      });

      console.log('✅ Demo user created with initial balance');
      console.log('📧 Email: demo@galina.ai');
      console.log('🔑 Password: demo123');
    } else {
      console.log('✅ Demo user already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing demo user:', error);
    // Don't exit process, just log error
  }
}

module.exports = { initializeDatabase, initializeDemoUser };
