import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  try {
    console.log('Deleting tasks...');
    await prisma.task.deleteMany();
    console.log('Deleting theses...');
    await prisma.thesis.deleteMany();
    console.log('Deleting users...');
    await prisma.user.deleteMany();
    console.log('Database cleanup completed.');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase(); 