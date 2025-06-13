import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const facultyUsername = 'faculty';
  const facultyPassword = 'faculty123'; // Change this to a secure password
  const hashedPassword = await bcrypt.hash(facultyPassword, 10);

  try {
    const faculty = await prisma.user.upsert({
      where: { username: facultyUsername },
      update: {},
      create: {
        username: facultyUsername,
        password: hashedPassword,
        email: 'faculty@university.edu',
        fullName: 'Faculty Admin',
        role: 'FACULTY',
      },
    });

    console.log('Faculty user created:', {
      ...faculty,
      password: '[REDACTED]',
    });
  } catch (error) {
    console.error('Error creating faculty user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 