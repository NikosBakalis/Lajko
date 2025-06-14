import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function createSecretary() {
  try {
    const hashedPassword = await bcrypt.hash('secretary123', 10);
    const secretary = await prisma.user.create({
      data: {
        username: 'secretary',
        password: hashedPassword,
        email: 'secretary@example.com',
        fullName: 'Department Secretary',
        role: 'SECRETARY',
        postalAddress: 'University Department, 123 Main St',
        mobilePhone: '+1234567890',
        landlinePhone: '+1234567891'
      }
    });

    console.log('Secretary created successfully:');
    console.log(JSON.stringify(secretary, null, 2));
  } catch (error) {
    console.error('Error creating secretary:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSecretary(); 