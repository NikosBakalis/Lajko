import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

async function clearDatabase() {
  try {
    // First, clear all thesis selections (many-to-many relationship)
    console.log('Clearing thesis selections...');
    await prisma.thesis.updateMany({
      where: {},
      data: {
        assignedToId: null
      }
    });

    // Clear supervising faculty relationships
    console.log('Clearing supervising faculty relationships...');
    await prisma.$executeRaw`DELETE FROM "_SupervisingFaculty"`;

    // Then delete all theses
    console.log('Deleting theses...');
    await prisma.thesis.deleteMany();

    // Finally delete all users
    console.log('Deleting users...');
    await prisma.user.deleteMany();

    console.log('Database cleanup completed successfully.');
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase(); 