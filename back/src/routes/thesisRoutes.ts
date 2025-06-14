import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Helper function to delete PDF file
const deletePdfFile = (pdfUrl: string | null) => {
  if (pdfUrl) {
    const pdfPath = path.join(__dirname, '../../', pdfUrl);
    if (fs.existsSync(pdfPath)) {
      try {
        fs.unlinkSync(pdfPath);
      } catch (error) {
        console.error('Error deleting PDF file:', error);
      }
    }
  }
};

// Get all theses
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  try {
    // Use Prisma client with type assertions to avoid TypeScript errors
    const theses = await prisma.$queryRaw`
      SELECT 
        t.id, t.title, t.description, t."pdfUrl", t.status, t.facultyId, t."assignedToId",
        json_object(
          'id', f.id,
          'username', f.username,
          'email', f.email,
          'fullName', f."fullName",
          'role', f.role
        ) as faculty,
        json_group_array(
          json_object(
            'id', sf.id,
            'username', sf.username,
            'email', sf.email,
            'fullName', sf."fullName",
            'role', sf.role
          )
        ) as supervisingFaculty,
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
      LEFT JOIN "User" f ON t."facultyId" = f.id
      LEFT JOIN "_SupervisingFaculty" sf_rel ON t.id = sf_rel.A
      LEFT JOIN "User" sf ON sf_rel.B = sf.id
      LEFT JOIN "_StudentSelections" ss ON t.id = ss.A
      LEFT JOIN "User" u ON ss.B = u.id
      GROUP BY t.id
      ORDER BY t.id DESC
    `;

    // Transform the data to match the frontend's expected format
    const formattedTheses = Array.isArray(theses) ? theses.map((thesis: any) => {
      let selectedByArray = [];
      let supervisingFacultyArray = [];
      try {
        // Parse the JSON string and filter out any null entries
        const parsedSelectedBy = JSON.parse(thesis.selectedBy || '[]');
        selectedByArray = Array.isArray(parsedSelectedBy) 
          ? parsedSelectedBy.filter((item: any) => item && item.id) 
          : [];

        const parsedSupervisingFaculty = JSON.parse(thesis.supervisingFaculty || '[]');
        supervisingFacultyArray = Array.isArray(parsedSupervisingFaculty)
          ? parsedSupervisingFaculty.filter((item: any) => item && item.id && item.role === 'FACULTY')
          : [];
      } catch (e) {
        console.error('Error parsing arrays:', e);
      }
      
      return {
        id: thesis.id,
        title: thesis.title,
        description: thesis.description,
        pdfUrl: thesis.pdfUrl,
        status: thesis.status,
        facultyId: thesis.facultyId,
        faculty: JSON.parse(thesis.faculty),
        supervisingFaculty: supervisingFacultyArray,
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
router.post('/', upload.single('pdf'), (req: Request, res: Response, next: NextFunction) => {
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

  const { title, description, supervisingFacultyIds } = req.body;
  const pdfFile = (req as any).file;

  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required' });
  }

  try {
    // Create thesis using raw SQL to avoid TypeScript errors
    const pdfUrl = pdfFile ? `/uploads/${pdfFile.filename}` : null;
    
    // Start a transaction
    await prisma.$transaction(async (tx) => {
      // Create the thesis
      const result = await tx.$executeRaw`
        INSERT INTO "Thesis" (title, description, "pdfUrl", status, "facultyId", "createdAt", "updatedAt") 
        VALUES (${title}, ${description}, ${pdfUrl}, 'OPEN', ${authReq.user!.id}, datetime('now'), datetime('now'))
      `;

      // Get the ID of the created thesis
      const thesis = await tx.$queryRaw`
        SELECT id FROM "Thesis" WHERE "facultyId" = ${authReq.user!.id} ORDER BY id DESC LIMIT 1
      `;

      if (!thesis || !Array.isArray(thesis) || thesis.length === 0) {
        throw new Error('Failed to create thesis');
      }

      const thesisId = thesis[0].id;

      // Add supervising faculty members if provided
      if (supervisingFacultyIds && Array.isArray(supervisingFacultyIds)) {
        for (const facultyId of supervisingFacultyIds) {
          // Check that the user is a faculty member
          const facultyUser = await tx.$queryRaw`SELECT * FROM "User" WHERE id = ${facultyId} AND role = 'FACULTY'`;
          if (!facultyUser || !Array.isArray(facultyUser) || facultyUser.length === 0) {
            throw new Error('All supervising faculty members must have the FACULTY role');
          }
          await tx.$executeRaw`
            INSERT INTO "_SupervisingFaculty" (A, B)
            VALUES (${thesisId}, ${facultyId})
          `;
        }
      }
    });

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

// Edit a thesis
router.put('/:id', upload.single('pdf'), (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is faculty
  if (authReq.user.role !== 'FACULTY') {
    return res.status(403).json({ message: 'Only faculty members can edit theses' });
  }

  const thesisId = parseInt(req.params.id);
  const { title, description, supervisingFacultyIds } = req.body;
  let parsedSupervisingFacultyIds = supervisingFacultyIds;
  if (typeof supervisingFacultyIds === 'string') {
    try {
      parsedSupervisingFacultyIds = JSON.parse(supervisingFacultyIds);
    } catch (e) {
      parsedSupervisingFacultyIds = [];
    }
  }
  const pdfFile = (req as any).file;

  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required' });
  }

  try {
    // Check if thesis exists and belongs to the faculty member
    const thesis = await prisma.$queryRaw`
      SELECT * FROM "Thesis" WHERE id = ${thesisId} AND "facultyId" = ${authReq.user!.id}
    `;

    if (!thesis || !Array.isArray(thesis) || thesis.length === 0) {
      return res.status(404).json({ message: 'Thesis not found or you do not have permission to edit it' });
    }

    // If a new PDF is uploaded, delete the old one
    if (pdfFile && thesis[0].pdfUrl) {
      deletePdfFile(thesis[0].pdfUrl);
    }

    // Update thesis
    const pdfUrl = pdfFile ? `/uploads/${pdfFile.filename}` : thesis[0].pdfUrl;
    
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "Thesis" 
        SET title = ${title}, 
            description = ${description}, 
            "pdfUrl" = ${pdfUrl},
            "updatedAt" = datetime('now')
        WHERE id = ${thesisId} AND "facultyId" = ${authReq.user!.id}
      `;

      // Clear existing supervising faculty relationships
      await tx.$executeRaw`DELETE FROM "_SupervisingFaculty" WHERE A = ${thesisId}`;

      // Add new supervising faculty members if provided
      if (parsedSupervisingFacultyIds && Array.isArray(parsedSupervisingFacultyIds) && parsedSupervisingFacultyIds.length > 0) {
        for (const facultyId of parsedSupervisingFacultyIds) {
          // Check that the user is a faculty member
          const facultyUser = await tx.$queryRaw`SELECT * FROM "User" WHERE id = ${facultyId} AND role = 'FACULTY'`;
          if (!facultyUser || !Array.isArray(facultyUser) || facultyUser.length === 0) {
            throw new Error('All supervising faculty members must have the FACULTY role');
          }
          await tx.$executeRaw`
            INSERT INTO "_SupervisingFaculty" (A, B)
            VALUES (${thesisId}, ${facultyId})
          `;
        }
      }
    });

    res.json({ message: 'Thesis updated successfully' });
  } catch (error) {
    console.error('Error updating thesis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a thesis
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is faculty
  if (authReq.user.role !== 'FACULTY') {
    return res.status(403).json({ message: 'Only faculty members can delete theses' });
  }

  const thesisId = parseInt(req.params.id);

  try {
    // Check if thesis exists and belongs to the faculty member
    const thesis = await prisma.$queryRaw`
      SELECT * FROM "Thesis" WHERE id = ${thesisId} AND "facultyId" = ${authReq.user.id}
    `;

    if (!thesis || !Array.isArray(thesis) || thesis.length === 0) {
      return res.status(404).json({ message: 'Thesis not found or you do not have permission to delete it' });
    }

    // Delete the PDF file if it exists
    deletePdfFile(thesis[0].pdfUrl);

    // Delete thesis
    await prisma.$executeRaw`
      DELETE FROM "Thesis" 
      WHERE id = ${thesisId} AND "facultyId" = ${authReq.user.id}
    `;

    res.json({ message: 'Thesis deleted successfully' });
  } catch (error) {
    console.error('Error deleting thesis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 