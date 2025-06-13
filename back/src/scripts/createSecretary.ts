import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createSecretary() {
  try {
    // Check if secretary already exists
    const existingSecretary = await prisma.user.findFirst({
      where: {
        role: UserRole.SECRETARY
      }
    });

    if (existingSecretary) {
      console.log('Secretary user already exists');
      return;
    }

    // Create secretary user
    const secretary = await prisma.user.create({
      data: {
        username: 'secretary',
        password: await bcrypt.hash('secretary123', 10),
        fullName: 'System Secretary',
        email: 'secretary@system.local',
        role: UserRole.SECRETARY
      }
    });

    console.log('Secretary user created successfully:', secretary);
  } catch (error) {
    console.error('Error creating secretary:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSecretary(); 