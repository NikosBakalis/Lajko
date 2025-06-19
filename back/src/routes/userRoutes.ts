import express, { Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';

const router = express.Router();

// Get all users (for admin/secretary)
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
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

// Get current user profile (must come before /:id route)
router.get('/profile', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        studentId: true,
        postalAddress: true,
        mobilePhone: true,
        landlinePhone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user by ID (for admin/secretary)
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
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

// Create new user (for admin/secretary)
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is secretary
  if (authReq.user.role !== 'SECRETARY') {
    return res.status(403).json({ message: 'Only secretaries can create users' });
  }

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

// Delete user (for admin/secretary)
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is secretary
  if (authReq.user.role !== 'SECRETARY') {
    return res.status(403).json({ message: 'Only secretaries can delete users' });
  }

  try {
    const userId = Number(req.params.id);
    
    // Use a transaction to ensure all related records are deleted properly
    await prisma.$transaction(async (tx) => {
      // Delete supervising faculty relationships where this user is the faculty member
      await tx.supervisingFaculty.deleteMany({
        where: { facultyId: userId }
      });

      // Delete supervising faculty relationships where this user is the inviter
      await tx.supervisingFaculty.deleteMany({
        where: { invitedById: userId }
      });

      // Delete student selections where this user is the student (using raw SQL for many-to-many)
      await tx.$executeRaw`
        DELETE FROM "_StudentSelections" WHERE B = ${userId}
      `;

      // Delete theses where this user is the faculty member
      await tx.thesis.deleteMany({
        where: { facultyId: userId }
      });

      // Delete theses where this user is the assigned student
      await tx.thesis.deleteMany({
        where: { assignedToId: userId }
      });

      // Finally delete the user
      await tx.user.delete({ 
        where: { id: userId }
      });
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

// Update current user profile
router.put('/profile', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const { fullName, email, studentId, postalAddress, mobilePhone, landlinePhone } = req.body;

  // Validate required fields
  if (!fullName || !email) {
    return res.status(400).json({ message: 'Full name and email are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: authReq.user.id }
      }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email is already taken by another user' });
    }

    // Check if studentId is already taken by another user (if provided)
    if (studentId) {
      const existingStudentId = await prisma.user.findFirst({
        where: {
          studentId,
          id: { not: authReq.user.id }
        }
      });

      if (existingStudentId) {
        return res.status(400).json({ message: 'Student ID is already taken by another user' });
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: authReq.user.id },
      data: {
        fullName,
        email,
        studentId: studentId || null,
        postalAddress: postalAddress || null,
        mobilePhone: mobilePhone || null,
        landlinePhone: landlinePhone || null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        studentId: true,
        postalAddress: true,
        mobilePhone: true,
        landlinePhone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 