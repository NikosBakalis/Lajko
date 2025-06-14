import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import thesisRoutes from './routes/thesisRoutes';

dotenv.config();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: string;
      };
    }
  }
}

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Middleware to verify JWT token
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role: string };
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user is faculty or secretary
const isFacultyOrSecretary = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'SECRETARY') {
    return res.status(403).json({ error: 'Access denied. Faculty or Secretary only.' });
  }
  next();
};

// Auth routes
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get current user endpoint
app.get('/users/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// User routes
app.get('/users', authenticateToken, async (req, res) => {
  try {
    const { role } = req.query;
    let users;
    if (role) {
      users = await prisma.user.findMany({ where: { role: role as string } });
    } else {
      users = await prisma.user.findMany();
    }
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/users', authenticateToken, isFacultyOrSecretary, async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['username', 'password', 'email', 'fullName', 'role'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: `Required fields missing: ${missingFields.join(', ')}`
      });
    }
    // Validate role
    const validRoles = ['FACULTY', 'STUDENT', 'SECRETARY'];
    if (!validRoles.includes(req.body.role)) {
      return res.status(400).json({
        error: 'Invalid role',
        details: `Role must be one of: ${validRoles.join(', ')}`
      });
    }
    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: req.body.username },
          { email: req.body.email }
        ]
      }
    });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        details: existingUser.username === req.body.username ?
          'Username already taken' : 'Email already registered'
      });
    }
    const { password, ...userData } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        studentId: userData.studentId || null,
        postalAddress: userData.postalAddress || null,
        mobilePhone: userData.mobilePhone || null,
        landlinePhone: userData.landlinePhone || null,
      },
    });
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ data: userWithoutPassword });
  } catch (error: unknown) {
    res.status(500).json({
      error: 'Failed to create user',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.delete('/users/:id', authenticateToken, isFacultyOrSecretary, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    
    // First, delete all theses associated with this user (both as faculty and as assigned student)
    await prisma.thesis.deleteMany({
      where: {
        OR: [
          { facultyId: userId },
          { assignedToId: userId }
        ]
      }
    });

    // Then delete the user
    await prisma.user.delete({ 
      where: { id: userId }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      error: 'Failed to delete user',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Thesis routes
app.use('/theses', thesisRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});