import express from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../lib/prisma';
import { Request, Response, NextFunction } from 'express';

// Define user interface for auth middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

const router = express.Router();

// Get all theses
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  try {
    // Use Prisma client with type assertions to avoid TypeScript errors
    const theses = await prisma.$queryRaw`
      SELECT 
        t.id, t.title, t.description, t.status, t.facultyId, t."assignedToId",
        json_group_array(
          json_object(
            'id', u.id,
            'username', u.username,
            'email', u.email,
            'fullName', u."fullName",
            'role', u.role
          )
        ) as selectedBy
      FROM "Thesis" t
      LEFT JOIN "_StudentSelections" ss ON t.id = ss.A
      LEFT JOIN "User" u ON ss.B = u.id
      GROUP BY t.id
      ORDER BY t.id DESC
    `;

    // Transform the data to match the frontend's expected format
    const formattedTheses = Array.isArray(theses) ? theses.map((thesis: any) => {
      let selectedByArray = [];
      try {
        // Parse the JSON string and filter out any null entries
        const parsedSelectedBy = JSON.parse(thesis.selectedBy || '[]');
        selectedByArray = Array.isArray(parsedSelectedBy) 
          ? parsedSelectedBy.filter((item: any) => item && item.id) 
          : [];
      } catch (e) {
        console.error('Error parsing selectedBy:', e);
      }
      
      return {
        id: thesis.id,
        title: thesis.title,
        description: thesis.description,
        status: thesis.status,
        facultyId: thesis.facultyId,
        assignedToId: thesis.assignedToId,
        selectedBy: selectedByArray
      };
    }) : [];

    res.json(formattedTheses);
  } catch (error) {
    console.error('Error fetching theses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new thesis
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is faculty
  if (authReq.user.role !== 'FACULTY') {
    return res.status(403).json({ message: 'Only faculty members can create theses' });
  }

  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required' });
  }

  try {
    // Create thesis using raw SQL to avoid TypeScript errors
    await prisma.$executeRaw`
      INSERT INTO "Thesis" (title, description, status, "facultyId", "createdAt", "updatedAt") 
      VALUES (${title}, ${description}, 'OPEN', ${authReq.user.id}, datetime('now'), datetime('now'))
    `;

    res.status(201).json({ message: 'Thesis created successfully' });
  } catch (error) {
    console.error('Error creating thesis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Select a thesis
router.post('/:id/select', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const thesisId = parseInt(req.params.id);
  const userId = authReq.user.id;

  try {
    // Check if thesis exists and is open
    const thesis = await prisma.$queryRaw`
      SELECT * FROM "Thesis" WHERE id = ${thesisId}
    `;

    if (!thesis || !Array.isArray(thesis) || thesis.length === 0) {
      return res.status(404).json({ message: 'Thesis not found' });
    }

    if (thesis[0].status !== 'OPEN') {
      return res.status(400).json({ message: 'Thesis is not available for selection' });
    }

    // Check if user already has a selected thesis
    const existingSelection = await prisma.$queryRaw`
      SELECT * FROM "_StudentSelections" WHERE B = ${userId}
    `;

    if (Array.isArray(existingSelection) && existingSelection.length > 0) {
      return res.status(400).json({ message: 'You have already selected a thesis' });
    }

    // Create selection
    await prisma.$executeRaw`
      INSERT INTO "_StudentSelections" (A, B) 
      VALUES (${thesisId}, ${userId})
    `;

    res.json({ message: 'Thesis selected successfully' });
  } catch (error) {
    console.error('Error selecting thesis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Unselect a thesis
router.post('/:id/unselect', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const thesisId = parseInt(req.params.id);
  const userId = authReq.user.id;

  try {
    // Check if selection exists
    const selection = await prisma.$queryRaw`
      SELECT * FROM "_StudentSelections" 
      WHERE A = ${thesisId} AND B = ${userId}
    `;

    if (!selection || !Array.isArray(selection) || selection.length === 0) {
      return res.status(404).json({ message: 'Thesis selection not found' });
    }

    // Remove selection
    await prisma.$executeRaw`
      DELETE FROM "_StudentSelections" 
      WHERE A = ${thesisId} AND B = ${userId}
    `;

    res.json({ message: 'Thesis unselected successfully' });
  } catch (error) {
    console.error('Error unselecting thesis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Assign a thesis to a student
router.post('/:id/assign', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is faculty
  if (authReq.user.role !== 'FACULTY') {
    return res.status(403).json({ message: 'Only faculty members can assign theses' });
  }

  const thesisId = parseInt(req.params.id);
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ message: 'Student ID is required' });
  }

  try {
    // Check if thesis exists
    const thesis = await prisma.$queryRaw`
      SELECT * FROM "Thesis" WHERE id = ${thesisId}
    `;

    if (!thesis || !Array.isArray(thesis) || thesis.length === 0) {
      return res.status(404).json({ message: 'Thesis not found' });
    }

    // Check if student exists
    const student = await prisma.$queryRaw`
      SELECT * FROM "User" WHERE id = ${studentId} AND role = 'STUDENT'
    `;

    if (!student || !Array.isArray(student) || student.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Update thesis status and assign to student
    await prisma.$executeRaw`
      UPDATE "Thesis" 
      SET status = 'ASSIGNED', "assignedToId" = ${studentId}, "updatedAt" = datetime('now')
      WHERE id = ${thesisId}
    `;

    res.json({ message: 'Thesis assigned successfully' });
  } catch (error) {
    console.error('Error assigning thesis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 