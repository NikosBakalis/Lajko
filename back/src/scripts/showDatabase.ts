import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showDatabase() {
  try {
    console.log('\n=== Database Contents ===\n');

    // Show Users
    console.log('Users:');
    const users = await prisma.user.findMany();
    console.log(JSON.stringify(users, null, 2));
    console.log('\n');

    // Show Theses
    console.log('Theses:');
    const theses = await prisma.thesis.findMany();
    console.log(JSON.stringify(theses, null, 2));
    console.log('\n');

  } catch (error) {
    console.error('Error showing database:', error);
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