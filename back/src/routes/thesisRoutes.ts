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
        acceptedAt: sf.acceptedAt,
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

  const { title, description } = req.body;
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
  const { title, description } = req.body;
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
      SELECT * FROM "Thesis" WHERE id = ${thesisId} AND "facultyId" = ${authReq.user!.id}
    `;

    if (!thesis || !Array.isArray(thesis) || thesis.length === 0) {
      return res.status(404).json({ message: 'Thesis not found or you do not have permission to delete it' });
    }

    // Delete related records first to handle foreign key constraints
    await prisma.$transaction(async (tx) => {
      // Delete supervising faculty records
      await tx.$executeRaw`
        DELETE FROM "SupervisingFaculty" WHERE thesisId = ${thesisId}
      `;

      // Delete student selections
      await tx.$executeRaw`
        DELETE FROM "_StudentSelections" WHERE A = ${thesisId}
      `;

      // Delete the student PDF file if it exists
      if (thesis[0].studentPdfUrl) {
        deletePdfFile(thesis[0].studentPdfUrl);
      }

      // Delete the faculty PDF file if it exists
      if (thesis[0].pdfUrl) {
        deletePdfFile(thesis[0].pdfUrl);
      }

      // Finally delete the thesis
      await tx.$executeRaw`
        DELETE FROM "Thesis" WHERE id = ${thesisId} AND "facultyId" = ${authReq.user!.id}
      `;
    });

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

    // Check how many supervisors have already accepted
    const acceptedSupervisors = await prisma.$queryRaw`
      SELECT * FROM "SupervisingFaculty" 
      WHERE thesisId = ${thesisId} AND status = 'ACCEPTED'
      ORDER BY "acceptedAt" ASC
    `;

    if (!acceptedSupervisors || !Array.isArray(acceptedSupervisors)) {
      return res.status(500).json({ message: 'Error retrieving supervising faculty information' });
    }

    // If already 2 supervisors have accepted, reject this invitation
    if (acceptedSupervisors.length >= 2) {
      // Delete the invitation since we already have 2 supervisors
      await prisma.$executeRaw`
        DELETE FROM "SupervisingFaculty" 
        WHERE thesisId = ${thesisId} AND facultyId = ${facultyId}
      `;

      return res.status(400).json({ 
        message: 'Cannot accept invitation. This thesis already has 2 supervisors.' 
      });
    }

    // Accept the invitation (this will be the 1st or 2nd supervisor)
    const currentTime = new Date().toISOString();
    
    // Update invitation status to ACCEPTED and set acceptedAt timestamp
    await prisma.$executeRaw`
      UPDATE "SupervisingFaculty" 
      SET status = 'ACCEPTED', "acceptedAt" = ${currentTime}
      WHERE thesisId = ${thesisId} AND facultyId = ${facultyId}
    `;

    // If this is the 2nd supervisor, automatically reject all remaining pending invitations
    if (acceptedSupervisors.length === 1) {
      await prisma.$executeRaw`
        DELETE FROM "SupervisingFaculty" 
        WHERE thesisId = ${thesisId} AND status = 'PENDING'
      `;
    }
    
    res.json({ 
      message: 'Invitation accepted successfully',
      position: acceptedSupervisors.length + 1
    });
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
      // Check if faculty is a supervisor and get their position
      const supervisingFaculty = await prisma.$queryRaw`
        SELECT * FROM "SupervisingFaculty" 
        WHERE thesisId = ${thesisId} AND facultyId = ${facultyId} AND status = 'ACCEPTED'
        ORDER BY "acceptedAt" ASC
      `;

      if (!supervisingFaculty || !Array.isArray(supervisingFaculty) || supervisingFaculty.length === 0) {
        return res.status(403).json({ message: 'You do not have permission to grade this thesis' });
      }

      // Get all supervising faculty for this thesis ordered by acceptance time
      const allSupervisingFaculty = await prisma.$queryRaw`
        SELECT * FROM "SupervisingFaculty" 
        WHERE thesisId = ${thesisId} AND status = 'ACCEPTED'
        ORDER BY "acceptedAt" ASC
      `;

      if (!allSupervisingFaculty || !Array.isArray(allSupervisingFaculty)) {
        return res.status(500).json({ message: 'Error retrieving supervising faculty information' });
      }

      // Find the position of the current faculty in the supervising faculty list
      const supervisorIndex = allSupervisingFaculty.findIndex((sf: any) => sf.facultyId === facultyId);
      
      if (supervisorIndex === -1) {
        return res.status(403).json({ message: 'You do not have permission to grade this thesis' });
      }

      // Only the first two supervisors can grade
      if (supervisorIndex >= 2) {
        return res.status(400).json({ message: 'Only the first two supervisors who accepted can grade this thesis' });
      }

      // Determine which supervisor slot to use based on position
      if (supervisorIndex === 0) {
        updateField = 'supervisor1Mark';
      } else if (supervisorIndex === 1) {
        updateField = 'supervisor2Mark';
      } else {
        return res.status(400).json({ message: 'Only the first two supervisors can grade this thesis' });
      }

      // Check if this supervisor has already graded
      const currentMark = supervisorIndex === 0 ? thesisData.supervisor1Mark : thesisData.supervisor2Mark;
      if (currentMark !== null) {
        return res.status(400).json({ message: 'You have already graded this thesis' });
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
      
      // Get the first two accepted supervisors
      const activeSupervisors = await prisma.$queryRaw`
        SELECT * FROM "SupervisingFaculty" 
        WHERE thesisId = ${thesisId} AND status = 'ACCEPTED'
        ORDER BY "acceptedAt" ASC
        LIMIT 2
      `;

      if (activeSupervisors && Array.isArray(activeSupervisors)) {
        // Check if main faculty and both supervisors have graded
        const hasMainFacultyMark = updatedThesisData.mainFacultyMark !== null;
        const hasSupervisor1Mark = activeSupervisors.length >= 1 && updatedThesisData.supervisor1Mark !== null;
        const hasSupervisor2Mark = activeSupervisors.length >= 2 && updatedThesisData.supervisor2Mark !== null;
        
        // Only calculate final mark and complete thesis if ALL required graders have graded
        if (hasMainFacultyMark && hasSupervisor1Mark && hasSupervisor2Mark) {
          // All three graders have graded - calculate final mark
          const finalMark = (updatedThesisData.mainFacultyMark + 
                            updatedThesisData.supervisor1Mark + 
                            updatedThesisData.supervisor2Mark) / 3;

          // Update final mark and change status to COMPLETED
          await prisma.$executeRaw`
            UPDATE "Thesis" 
            SET "finalMark" = ${finalMark},
                status = 'COMPLETED',
                "updatedAt" = datetime('now')
            WHERE id = ${thesisId}
          `;
        } else if (hasMainFacultyMark && hasSupervisor1Mark && activeSupervisors.length === 1) {
          // Only 1 supervisor accepted and both main faculty and supervisor have graded
          const finalMark = (updatedThesisData.mainFacultyMark + updatedThesisData.supervisor1Mark) / 2;

          // Update final mark and change status to COMPLETED
          await prisma.$executeRaw`
            UPDATE "Thesis" 
            SET "finalMark" = ${finalMark},
                status = 'COMPLETED',
                "updatedAt" = datetime('now')
            WHERE id = ${thesisId}
          `;
        }
        // If not all required graders have graded, don't complete the thesis yet
      }
    }

    res.json({ message: 'Thesis graded successfully' });
  } catch (error) {
    console.error('Error grading thesis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Invite a supervisor (student-initiated)
router.post('/:id/invite-supervisor', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as any, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Only students can invite supervisors
  if (authReq.user.role !== 'STUDENT') {
    return res.status(403).json({ message: 'Only students can invite supervisors' });
  }

  const thesisId = parseInt(req.params.id);
  const { facultyId } = req.body;

  if (!facultyId) {
    return res.status(400).json({ message: 'Faculty ID is required' });
  }

  try {
    // Check if thesis exists and is assigned to this student
    const thesis = await prisma.thesis.findUnique({ where: { id: thesisId } });
    if (!thesis || thesis.assignedToId !== authReq.user.id) {
      return res.status(403).json({ message: 'You are not assigned to this thesis' });
    }

    // Check if faculty exists and is a faculty member
    const faculty = await prisma.user.findUnique({ where: { id: facultyId } });
    if (!faculty || faculty.role !== 'FACULTY') {
      return res.status(404).json({ message: 'Faculty member not found' });
    }

    // Check if already invited
    const existing = await prisma.supervisingFaculty.findUnique({
      where: { thesisId_facultyId: { thesisId, facultyId } },
    });
    if (existing) {
      return res.status(400).json({ message: 'This faculty member has already been invited' });
    }

    // Check if already have 2 accepted supervisors
    const acceptedSupervisors = await prisma.supervisingFaculty.findMany({
      where: { thesisId, status: 'ACCEPTED' },
    });
    if (acceptedSupervisors.length >= 2) {
      return res.status(400).json({ message: 'Cannot invite more supervisors. This thesis already has 2 supervisors.' });
    }

    // Create invitation
    await prisma.supervisingFaculty.create({
      data: {
        thesisId,
        facultyId,
        status: 'PENDING',
        invitedById: authReq.user.id,
      } as any,
    });

    res.json({ message: 'Supervisor invited successfully' });
  } catch (error) {
    console.error('Error inviting supervisor:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 