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
    const theses = await prisma.thesis.findMany({
      include: {
        faculty: true,
        supervisingFaculty: {
          include: {
            faculty: true,
          },
        },
        selectedBy: true,
        assignedTo: true,
      },
      orderBy: { id: 'desc' },
    });

    // Transform the data to match the frontend's expected format
    const formattedTheses = theses.map((thesis: any) => ({
      id: thesis.id,
      title: thesis.title,
      description: thesis.description,
      pdfUrl: thesis.pdfUrl,
      studentPdfUrl: thesis.studentPdfUrl,
      status: thesis.status,
      facultyId: thesis.facultyId,
      faculty: thesis.faculty,
      supervisingFaculty: thesis.supervisingFaculty.map((sf: any) => ({
        id: sf.faculty.id,
        username: sf.faculty.username,
        email: sf.faculty.email,
        fullName: sf.faculty.fullName,
        role: sf.faculty.role,
        status: sf.status,
      })),
      assignedToId: thesis.assignedToId,
      assignedTo: thesis.assignedTo,
      selectedBy: thesis.selectedBy,
      mainFacultyMark: thesis.mainFacultyMark,
      supervisor1Mark: thesis.supervisor1Mark,
      supervisor2Mark: thesis.supervisor2Mark,
      finalMark: thesis.finalMark,
    }));

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
      if (parsedSupervisingFacultyIds && Array.isArray(parsedSupervisingFacultyIds) && parsedSupervisingFacultyIds.length > 0) {
        for (const facultyId of parsedSupervisingFacultyIds) {
          // Check that the user is a faculty member
          const facultyUser = await tx.$queryRaw`SELECT * FROM "User" WHERE id = ${facultyId} AND role = 'FACULTY'`;
          if (!facultyUser || !Array.isArray(facultyUser) || facultyUser.length === 0) {
            throw new Error('All supervising faculty members must have the FACULTY role');
          }
          await tx.$executeRaw`
            INSERT INTO "SupervisingFaculty" (thesisId, facultyId, status)
            VALUES (${thesisId}, ${facultyId}, 'PENDING')
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

      // Get existing supervising faculty relationships to preserve their statuses
      const existingSupervisingFaculty = await tx.$queryRaw`
        SELECT facultyId, status FROM "SupervisingFaculty" WHERE thesisId = ${thesisId}
      `;
      
      const existingStatuses = new Map();
      if (Array.isArray(existingSupervisingFaculty)) {
        existingSupervisingFaculty.forEach((item: any) => {
          existingStatuses.set(item.facultyId, item.status);
        });
      }

      // Clear existing supervising faculty relationships
      await tx.$executeRaw`DELETE FROM "SupervisingFaculty" WHERE thesisId = ${thesisId}`;

      // Add new supervising faculty members if provided
      if (parsedSupervisingFacultyIds && Array.isArray(parsedSupervisingFacultyIds) && parsedSupervisingFacultyIds.length > 0) {
        for (const facultyId of parsedSupervisingFacultyIds) {
          // Check that the user is a faculty member
          const facultyUser = await tx.$queryRaw`SELECT * FROM "User" WHERE id = ${facultyId} AND role = 'FACULTY'`;
          if (!facultyUser || !Array.isArray(facultyUser) || facultyUser.length === 0) {
            throw new Error('All supervising faculty members must have the FACULTY role');
          }
          
          // Preserve existing status or set to PENDING for new faculty members
          const status = existingStatuses.has(facultyId) ? existingStatuses.get(facultyId) : 'PENDING';
          
          await tx.$executeRaw`
            INSERT INTO "SupervisingFaculty" (thesisId, facultyId, status)
            VALUES (${thesisId}, ${facultyId}, ${status})
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

// Accept supervising faculty invitation
router.post('/:id/accept-invitation', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is faculty
  if (authReq.user.role !== 'FACULTY') {
    return res.status(403).json({ message: 'Only faculty members can accept invitations' });
  }

  const thesisId = parseInt(req.params.id);
  const facultyId = authReq.user.id;

  try {
    // Check if invitation exists
    const invitation = await prisma.$queryRaw`
      SELECT * FROM "SupervisingFaculty" 
      WHERE thesisId = ${thesisId} AND facultyId = ${facultyId} AND status = 'PENDING'
    `;

    if (!invitation || !Array.isArray(invitation) || invitation.length === 0) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Update invitation status to ACCEPTED
    await prisma.$executeRaw`
      UPDATE "SupervisingFaculty" 
      SET status = 'ACCEPTED'
      WHERE thesisId = ${thesisId} AND facultyId = ${facultyId}
    `;

    res.json({ message: 'Invitation accepted successfully' });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reject supervising faculty invitation
router.post('/:id/reject-invitation', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is faculty
  if (authReq.user.role !== 'FACULTY') {
    return res.status(403).json({ message: 'Only faculty members can reject invitations' });
  }

  const thesisId = parseInt(req.params.id);
  const facultyId = authReq.user.id;

  try {
    // Check if invitation exists
    const invitation = await prisma.$queryRaw`
      SELECT * FROM "SupervisingFaculty" 
      WHERE thesisId = ${thesisId} AND facultyId = ${facultyId} AND status = 'PENDING'
    `;

    if (!invitation || !Array.isArray(invitation) || invitation.length === 0) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Delete the invitation
    await prisma.$executeRaw`
      DELETE FROM "SupervisingFaculty" 
      WHERE thesisId = ${thesisId} AND facultyId = ${facultyId}
    `;

    res.json({ message: 'Invitation rejected successfully' });
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Upload student thesis PDF
router.post('/:id/upload-student-thesis', upload.single('thesisPdf'), (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is a student
  if (authReq.user.role !== 'STUDENT') {
    return res.status(403).json({ message: 'Only students can upload thesis PDFs' });
  }

  const thesisId = parseInt(req.params.id);
  const pdfFile = (req as any).file;

  if (!pdfFile) {
    return res.status(400).json({ message: 'PDF file is required' });
  }

  try {
    // Check if thesis exists and is assigned to the student
    const thesis = await prisma.$queryRaw`
      SELECT * FROM "Thesis" WHERE id = ${thesisId} AND "assignedToId" = ${authReq.user.id}
    `;

    if (!thesis || !Array.isArray(thesis) || thesis.length === 0) {
      return res.status(404).json({ message: 'Thesis not found or you are not assigned to it' });
    }

    // If a student PDF already exists, delete the old one
    if (thesis[0].studentPdfUrl) {
      deletePdfFile(thesis[0].studentPdfUrl);
    }

    // Update thesis with student PDF URL
    const studentPdfUrl = `/uploads/${pdfFile.filename}`;
    
    await prisma.$executeRaw`
      UPDATE "Thesis" 
      SET "studentPdfUrl" = ${studentPdfUrl},
          "updatedAt" = datetime('now')
      WHERE id = ${thesisId} AND "assignedToId" = ${authReq.user.id}
    `;

    res.json({ message: 'Student thesis PDF uploaded successfully' });
  } catch (error) {
    console.error('Error uploading student thesis PDF:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Grade student thesis
router.post('/:id/grade', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Check if user is faculty
  if (authReq.user.role !== 'FACULTY') {
    return res.status(403).json({ message: 'Only faculty members can grade theses' });
  }

  const thesisId = parseInt(req.params.id);
  const { mark } = req.body;

  if (mark === undefined || mark < 0 || mark > 10) {
    return res.status(400).json({ message: 'Mark must be between 0 and 10' });
  }

  try {
    // Check if thesis exists and faculty has permission to grade it
    const thesis = await prisma.$queryRaw`
      SELECT * FROM "Thesis" WHERE id = ${thesisId}
    `;

    if (!thesis || !Array.isArray(thesis) || thesis.length === 0) {
      return res.status(404).json({ message: 'Thesis not found' });
    }

    const thesisData = thesis[0];
    const facultyId = authReq.user.id;
    let updateField = '';
    let updateValue = mark;

    // Determine which mark field to update based on faculty role
    if (thesisData.facultyId === facultyId) {
      // Main faculty
      updateField = 'mainFacultyMark';
    } else {
      // Check if faculty is a supervisor
      const supervisingFaculty = await prisma.$queryRaw`
        SELECT * FROM "SupervisingFaculty" 
        WHERE thesisId = ${thesisId} AND facultyId = ${facultyId} AND status = 'ACCEPTED'
      `;

      if (!supervisingFaculty || !Array.isArray(supervisingFaculty) || supervisingFaculty.length === 0) {
        return res.status(403).json({ message: 'You do not have permission to grade this thesis' });
      }

      // Determine which supervisor slot to use
      if (thesisData.supervisor1Mark === null) {
        updateField = 'supervisor1Mark';
      } else if (thesisData.supervisor2Mark === null) {
        updateField = 'supervisor2Mark';
      } else {
        return res.status(400).json({ message: 'All supervisor marks have already been assigned' });
      }
    }

    // Update the mark
    const updateSql = `
      UPDATE "Thesis"
      SET ${updateField} = ?, "updatedAt" = datetime('now')
      WHERE id = ?
    `;
    await prisma.$executeRawUnsafe(updateSql, updateValue, thesisId);

    // Calculate final mark if all marks are available
    const updatedThesis = await prisma.$queryRaw`
      SELECT * FROM "Thesis" WHERE id = ${thesisId}
    `;

    if (updatedThesis && Array.isArray(updatedThesis) && updatedThesis.length > 0) {
      const updatedThesisData = updatedThesis[0];
      
      // Check if all marks are available
      if (updatedThesisData.mainFacultyMark !== null && 
          updatedThesisData.supervisor1Mark !== null && 
          updatedThesisData.supervisor2Mark !== null) {
        
        const finalMark = (updatedThesisData.mainFacultyMark + 
                          updatedThesisData.supervisor1Mark + 
                          updatedThesisData.supervisor2Mark) / 3;

        await prisma.$executeRaw`
          UPDATE "Thesis" 
          SET "finalMark" = ${finalMark},
              "updatedAt" = datetime('now')
          WHERE id = ${thesisId}
        `;
      }
    }

    res.json({ message: 'Thesis graded successfully' });
  } catch (error) {
    console.error('Error grading thesis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 