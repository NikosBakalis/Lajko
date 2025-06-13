import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Register route (only for students)
router.post('/register', async (req, res) => {
  const { username, password, email, fullName, studentId } = req.body;

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
          { studentId },
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username, email, or student ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        fullName,
        studentId,
        role: UserRole.STUDENT,
      },
    });

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register' });
  }
});

export default router; 