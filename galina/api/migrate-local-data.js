#!/usr/bin/env node

/**
 * Migration script to transfer existing localStorage data to database
 * Usage: node migrate-local-data.js <localStorage-data-file>
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateData(localStorageData) {
  console.log('🚀 Starting data migration from localStorage to database...');

  let migratedItems = {
    users: 0,
    balances: 0,
    messages: 0,
    files: 0
  };

  let errors = [];

  try {
    // Check if demo user exists, create if not
    let demoUser = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          email: 'demo@galina.ai',
          name: 'Demo User',
        },
      });
      migratedItems.users++;
      console.log('✅ Created demo user');
    }

    // Migrate balance
    if (localStorageData.balance !== undefined) {
      const existingBalance = await prisma.userBalance.findUnique({
        where: { userId: demoUser.id }
      });

      if (!existingBalance) {
        await prisma.userBalance.create({
          data: {
            userId: demoUser.id,
            amount: localStorageData.balance,
          },
        });
        migratedItems.balances++;
        console.log(`✅ Migrated balance: ${localStorageData.balance} RUB`);
      } else {
        console.log('ℹ️ Balance already exists, skipping');
      }
    }

    // Migrate chat messages
    if (localStorageData.messages && Array.isArray(localStorageData.messages)) {
      console.log(`📝 Migrating ${localStorageData.messages.length} chat messages...`);

      for (const message of localStorageData.messages) {
        try {
          // Check if message already exists
          const existingMessage = await prisma.chatMessage.findUnique({
            where: { id: message.id }
          });

          if (!existingMessage) {
            const messageData = {
              id: message.id,
              content: message.content,
              role: message.role,
              userId: demoUser.id,
              timestamp: new Date(message.timestamp),
            };

            const createdMessage = await prisma.chatMessage.create({
              data: messageData,
            });

            migratedItems.messages++;

            // Migrate files if any
            if (message.files && Array.isArray(message.files)) {
              for (const file of message.files) {
                try {
                  await prisma.file.create({
                    data: {
                      name: file.name,
                      type: file.type,
                      size: file.size,
                      content: file.content,
                      userId: demoUser.id,
                      messageId: createdMessage.id,
                    },
                  });
                  migratedItems.files++;
                } catch (fileError) {
                  errors.push(`Failed to migrate file ${file.name}: ${fileError.message}`);
                }
              }
            }
          }
        } catch (messageError) {
          errors.push(`Failed to migrate message ${message.id}: ${messageError.message}`);
        }
      }

      console.log(`✅ Migrated ${migratedItems.messages} messages and ${migratedItems.files} files`);
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   Users: ${migratedItems.users}`);
    console.log(`   Balances: ${migratedItems.balances}`);
    console.log(`   Messages: ${migratedItems.messages}`);
    console.log(`   Files: ${migratedItems.files}`);
    console.log(`   Total: ${Object.values(migratedItems).reduce((a, b) => a + b, 0)} items`);

    if (errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node migrate-local-data.js <localStorage-data-file>');
    console.log('Example: node migrate-local-data.js ./localStorage-backup.json');
    process.exit(1);
  }

  const dataFile = args[0];

  try {
    // Check if file exists
    if (!fs.existsSync(dataFile)) {
      console.error(`❌ Data file not found: ${dataFile}`);
      process.exit(1);
    }

    // Read and parse data
    const data = fs.readFileSync(dataFile, 'utf8');
    const localStorageData = JSON.parse(data);

    console.log(`📂 Loaded data from ${dataFile}`);
    console.log(`   Balance: ${localStorageData.balance || 'not found'}`);
    console.log(`   Messages: ${localStorageData.messages ? localStorageData.messages.length : 0}`);
    console.log(`   User: ${localStorageData.user ? 'found' : 'not found'}`);

    await migrateData(localStorageData);

  } catch (error) {
    console.error('❌ Failed to load data file:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateData };
