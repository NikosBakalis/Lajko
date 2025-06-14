import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function showDatabase() {
  try {
    console.log('\n=== Users ===');
    const users = await prisma.user.findMany();
    console.log('Total users:', users.length);
    console.log(JSON.stringify(users, null, 2));

    console.log('\n=== Theses ===');
    const theses = await prisma.thesis.findMany();
    console.log('Total theses:', theses.length);
    console.log(JSON.stringify(theses, null, 2));

  } catch (error) {
    console.error('Error showing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
showDatabase()
  .catch((error) => {
    console.error('Failed to show database:', error);
    process.exit(1);
  }); 