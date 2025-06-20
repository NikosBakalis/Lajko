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

// Bulk create users (for admin/secretary)
router.post('/bulk', (req: Request, res: Response, next: NextFunction) => {
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
    const users = req.body;
    
    if (!Array.isArray(users)) {
      return res.status(400).json({
        error: 'Invalid input',
        details: 'Request body must be an array of users'
      });
    }

    if (users.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        details: 'Users array cannot be empty'
      });
    }

    if (users.length > 100) {
      return res.status(400).json({
        error: 'Invalid input',
        details: 'Cannot create more than 100 users at once'
      });
    }

    const requiredFields = ['username', 'password', 'email', 'fullName', 'role'];
    const validRoles = ['FACULTY', 'STUDENT', 'SECRETARY'];
    
    // Validate all users first
    const validationErrors: Array<{ index: number; error: string }> = [];
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      // Check required fields
      const missingFields = requiredFields.filter(field => !user[field]);
      if (missingFields.length > 0) {
        validationErrors.push({
          index: i,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
        continue;
      }
      
      // Validate role
      if (!validRoles.includes(user.role)) {
        validationErrors.push({
          index: i,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
        continue;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user.email)) {
        validationErrors.push({
          index: i,
          error: 'Invalid email format'
        });
        continue;
      }
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Check for duplicate usernames and emails across all users
    const usernames = users.map(u => u.username);
    const emails = users.map(u => u.email);
    
    const duplicateUsernames = usernames.filter((username, index) => usernames.indexOf(username) !== index);
    const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
    
    if (duplicateUsernames.length > 0) {
      return res.status(400).json({
        error: 'Duplicate usernames found',
        details: `Duplicate usernames: ${duplicateUsernames.join(', ')}`
      });
    }
    
    if (duplicateEmails.length > 0) {
      return res.status(400).json({
        error: 'Duplicate emails found',
        details: `Duplicate emails: ${duplicateEmails.join(', ')}`
      });
    }

    // Check if any usernames or emails already exist in database
    const existingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { username: { in: usernames } },
          { email: { in: emails } }
        ]
      }
    });

    if (existingUsers.length > 0) {
      const existingUsernames = existingUsers.map(u => u.username);
      const existingEmails = existingUsers.map(u => u.email);
      
      return res.status(400).json({
        error: 'Users already exist',
        details: {
          existingUsernames,
          existingEmails
        }
      });
    }

    // Create all users in a transaction
    const createdUsers = await prisma.$transaction(async (tx) => {
      const results = [];
      
      for (const userData of users) {
        const { password, ...user } = userData;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const createdUser = await tx.user.create({
          data: {
            ...user,
            password: hashedPassword,
            studentId: user.studentId || null,
            postalAddress: user.postalAddress || null,
            mobilePhone: user.mobilePhone || null,
            landlinePhone: user.landlinePhone || null,
          },
        });
        
        const { password: _, ...userWithoutPassword } = createdUser;
        results.push(userWithoutPassword);
      }
      
      return results;
    });

    res.status(201).json({
      message: `Successfully created ${createdUsers.length} users`,
      data: createdUsers
    });
  } catch (error: unknown) {
    console.error('Error creating users in bulk:', error);
    res.status(500).json({
      error: 'Failed to create users',
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