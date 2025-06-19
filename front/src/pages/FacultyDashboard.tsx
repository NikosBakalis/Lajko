import React, { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
  Rating,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Thesis, ThesisStatus } from '../types';
import UploadIcon from '@mui/icons-material/Upload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import GradeIcon from '@mui/icons-material/Grade';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`thesis-tabpanel-${index}`}
      aria-labelledby={`thesis-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Helper function to get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case 'OPEN':
      return '#2e7d32'; // green
    case 'ASSIGNED':
      return '#ed6c02'; // orange
    case 'COMPLETED':
      return '#0288d1'; // blue
    case 'CANCELLED':
      return '#d32f2f'; // red
    default:
      return '#757575'; // grey
  }
};

export const FacultyDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [myTheses, setMyTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newThesis, setNewThesis] = useState({ title: '', description: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [pdfPreview, setPdfPreview] = useState<{ [key: string]: boolean }>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingThesis, setEditingThesis] = useState<Thesis | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [thesisToDelete, setThesisToDelete] = useState<number | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<Thesis[]>([]);
  const [gradingDialogOpen, setGradingDialogOpen] = useState(false);
  const [thesisToGrade, setThesisToGrade] = useState<Thesis | null>(null);
  const [grade, setGrade] = useState<number>(0);
  const [grading, setGrading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<Thesis[]>('/theses');
      const theses = response.data;
      
      // Filter theses where faculty is either the main faculty member or a supervising faculty member
      const facultyTheses = theses.filter(t => 
        t.facultyId === user?.id || 
        t.supervisingFaculty.some((faculty: any) => 
          faculty.id === user?.id && faculty.status === 'ACCEPTED'
        )
      );
      setMyTheses(facultyTheses);

      // Filter pending invitations for the current faculty member
      const invitations = theses.filter((thesis: Thesis) => 
        thesis.supervisingFaculty.some((faculty: any) => 
          faculty.id === user?.id && faculty.status === 'PENDING'
        )
      );
      setPendingInvitations(invitations);
    } catch (err) {
      setError('Failed to load data. Please try again later.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateThesis = async () => {
    try {
      setError(null);
      const formData = new FormData();
      formData.append('title', newThesis.title);
      formData.append('description', newThesis.description);
      if (selectedFile) {
        formData.append('pdf', selectedFile);
      }

      await api.post('/theses', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setCreateDialogOpen(false);
      setNewThesis({ title: '', description: '' });
      setSelectedFile(null);
      loadData();
    } catch (err) {
      setError('Failed to create thesis. Please try again later.');
      console.error('Error creating thesis:', err);
    }
  };

  const handleAssignThesis = async (thesisId: number, studentId: number) => {
    try {
      setError(null);
      await api.post(`/theses/${thesisId}/assign`, { studentId });
      loadData();
    } catch (err) {
      setError('Failed to assign thesis. Please try again later.');
      console.error('Error assigning thesis:', err);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleEditThesis = async () => {
    if (!editingThesis) return;

    try {
      setError(null);
      const formData = new FormData();
      formData.append('title', editingThesis.title);
      formData.append('description', editingThesis.description);
      if (selectedFile) {
        formData.append('pdf', selectedFile);
      }

      await api.put(`/theses/${editingThesis.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setEditDialogOpen(false);
      setEditingThesis(null);
      setSelectedFile(null);
      loadData();
    } catch (err) {
      setError('Failed to update thesis. Please try again later.');
      console.error('Error updating thesis:', err);
    }
  };

  const handleDeleteThesis = async () => {
    if (!thesisToDelete) return;

    try {
      setError(null);
      await api.delete(`/theses/${thesisToDelete}`);
      setDeleteConfirmOpen(false);
      setThesisToDelete(null);
      loadData();
    } catch (err) {
      setError('Failed to delete thesis. Please try again later.');
      console.error('Error deleting thesis:', err);
    }
  };

  const handleAcceptInvitation = async (thesisId: number) => {
    try {
      await api.post(`/theses/${thesisId}/accept-invitation`);
      await loadData(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    }
  };

  const handleRejectInvitation = async (thesisId: number) => {
    try {
      await api.post(`/theses/${thesisId}/reject-invitation`);
      await loadData(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject invitation');
    }
  };

  const handleGradeThesis = async () => {
    if (!thesisToGrade) return;

    try {
      setGrading(true);
      setError(null);
      
      await api.post(`/theses/${thesisToGrade.id}/grade`, { mark: grade });
      
      setGradingDialogOpen(false);
      setThesisToGrade(null);
      setGrade(0);
      await loadData();
    } catch (err) {
      setError('Failed to grade thesis. Please try again later.');
      console.error('Error grading thesis:', err);
    } finally {
      setGrading(false);
    }
  };

  const canGradeThesis = (thesis: Thesis) => {
    if (!user || thesis.status !== ThesisStatus.ASSIGNED || !thesis.studentPdfUrl) return false;
    
    // Main faculty can always grade
    if (thesis.facultyId === user.id) return true;
    
    // Check if user is an accepted supervisor (only the first two can accept)
    return thesis.supervisingFaculty.some((faculty: any) => 
      faculty.id === user.id && faculty.status === 'ACCEPTED'
    );
  };

  const getFacultyRole = (thesis: Thesis) => {
    if (!user) return null;
    
    if (thesis.facultyId === user.id) return 'MAIN_FACULTY';
    
    const acceptedSupervisors = thesis.supervisingFaculty
      .filter((faculty: any) => faculty.status === 'ACCEPTED')
      .sort((a: any, b: any) => {
        if (!a.acceptedAt && !b.acceptedAt) return 0;
        if (!a.acceptedAt) return 1;
        if (!b.acceptedAt) return -1;
        return new Date(a.acceptedAt).getTime() - new Date(b.acceptedAt).getTime();
      });
    
    const supervisorIndex = acceptedSupervisors.findIndex((faculty: any) => faculty.id === user.id);
    
    if (supervisorIndex === 0) return 'SUPERVISOR_1';
    if (supervisorIndex === 1) return 'SUPERVISOR_2';
    
    return null;
  };

  const hasGraded = (thesis: Thesis) => {
    if (!user) return false;
    
    if (thesis.facultyId === user.id) {
      return thesis.mainFacultyMark !== null && thesis.mainFacultyMark !== undefined;
    }
    
    // For supervisors, check if they've already graded based on their position
    const acceptedSupervisors = thesis.supervisingFaculty
      .filter((faculty: any) => faculty.status === 'ACCEPTED')
      .sort((a: any, b: any) => {
        if (!a.acceptedAt && !b.acceptedAt) return 0;
        if (!a.acceptedAt) return 1;
        if (!b.acceptedAt) return -1;
        return new Date(a.acceptedAt).getTime() - new Date(b.acceptedAt).getTime();
      });
    
    const supervisorIndex = acceptedSupervisors.findIndex((faculty: any) => faculty.id === user.id);
    
    if (supervisorIndex === 0) {
      return thesis.supervisor1Mark !== null && thesis.supervisor1Mark !== undefined;
    } else if (supervisorIndex === 1) {
      return thesis.supervisor2Mark !== null && thesis.supervisor2Mark !== undefined;
    }
    
    return false;
  };

  if (loading) {
    return (
      <Container>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Faculty Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setCreateDialogOpen(true)}
          >
            Create New Thesis
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        <Tabs
          value={tabValue}
          onChange={(event: React.SyntheticEvent, newValue: number) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
          centered
        >
          <Tab label="All Theses" />
          <Tab label="Open Theses" />
          <Tab label="Assigned Theses" />
          <Tab label="Completed Theses" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {myTheses.map((thesis) => (
              <Card key={thesis.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6">{thesis.title}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: getStatusColor(thesis.status),
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          border: 1,
                          borderColor: getStatusColor(thesis.status),
                        }}
                      >
                        {thesis.status}
                      </Typography>
                      {thesis.facultyId === user?.id && (
                        <>
                          <Button
                            startIcon={<EditIcon />}
                            onClick={() => {
                              setEditingThesis(thesis);
                              setEditDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            startIcon={<DeleteIcon />}
                            color="error"
                            onClick={() => {
                              setThesisToDelete(thesis.id);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </Box>
                  </Box>
                  <Typography color="textSecondary" paragraph>
                    {thesis.description}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <strong>Faculty:</strong> {thesis.faculty.fullName}
                    {thesis.facultyId === user?.id && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          ml: 1,
                          px: 1,
                          py: 0.5,
                          bgcolor: 'primary.main',
                          color: 'white',
                          borderRadius: 1,
                          fontSize: '0.7rem',
                        }}
                      >
                        MAIN FACULTY
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <strong>Supervising Faculty: </strong> 
                    {thesis.supervisingFaculty.length > 0 ? (
                      thesis.supervisingFaculty.map((faculty: any, index: number) => {
                        return (
                          <span key={faculty.id}>
                            {faculty.fullName}
                            {faculty.id === user?.id && faculty.status === 'ACCEPTED' && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{
                                  ml: 1,
                                  px: 1,
                                  py: 0.5,
                                  bgcolor: 'secondary.main',
                                  color: 'white',
                                  borderRadius: 1,
                                  fontSize: '0.7rem',
                                }}
                              >
                                SUPERVISOR
                              </Typography>
                            )}
                            {faculty.status === 'ACCEPTED' && faculty.id !== user?.id && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{
                                  ml: 1,
                                  px: 1,
                                  py: 0.5,
                                  bgcolor: 'success.main',
                                  color: 'white',
                                  borderRadius: 1,
                                  fontSize: '0.7rem',
                                }}
                              >
                                SUPERVISOR
                              </Typography>
                            )}
                            {faculty.status === 'PENDING' && faculty.id !== user?.id && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{
                                  ml: 1,
                                  px: 1,
                                  py: 0.5,
                                  bgcolor: 'warning.main',
                                  color: 'white',
                                  borderRadius: 1,
                                  fontSize: '0.7rem',
                                }}
                              >
                                PENDING
                              </Typography>
                            )}
                            {faculty.status === 'REJECTED' && faculty.id !== user?.id && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{
                                  ml: 1,
                                  px: 1,
                                  py: 0.5,
                                  bgcolor: 'error.main',
                                  color: 'white',
                                  borderRadius: 1,
                                  fontSize: '0.7rem',
                                }}
                              >
                                REJECTED
                              </Typography>
                            )}
                            {index < thesis.supervisingFaculty.length - 1 && ', '}
                          </span>
                        );
                      })
                    ) : (
                      'None'
                    )}
                  </Typography>
                  {thesis.pdfUrl && (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<PictureAsPdfIcon />}
                        href={`${api.defaults.baseURL}${thesis.pdfUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ mb: 1 }}
                      >
                        View PDF
                      </Button>
                      <Button
                        variant="text"
                        onClick={() => setPdfPreview(prev => ({ ...prev, [thesis.id]: !prev[thesis.id] }))}
                        sx={{ ml: 2 }}
                      >
                        {pdfPreview[thesis.id] ? 'Hide Preview' : 'Preview PDF'}
                      </Button>
                      {pdfPreview[thesis.id] && (
                        <iframe
                          src={`${api.defaults.baseURL}${thesis.pdfUrl}`}
                          width="100%"
                          height="500px"
                          style={{ border: '1px solid #ccc', borderRadius: 4, marginTop: 8 }}
                          title={`Thesis PDF ${thesis.id}`}
                        />
                      )}
                    </Box>
                  )}
                  
                  {thesis.selectedBy && thesis.selectedBy.length > 0 && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>
                        Students who selected this thesis:
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Email</TableCell>
                              <TableCell align="right">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {thesis.selectedBy.map((student) => (
                              <TableRow key={student.id}>
                                <TableCell>{student.fullName}</TableCell>
                                <TableCell>{student.email}</TableCell>
                                <TableCell align="right">
                                  {thesis.facultyId === user?.id && thesis.status === ThesisStatus.OPEN && (
                                    <Button
                                      size="small"
                                      color="primary"
                                      onClick={() => handleAssignThesis(thesis.id, student.id)}
                                    >
                                      Assign Thesis
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}

                  {thesis.assignedTo && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1">
                        Assigned to: {thesis.assignedTo.fullName}
                      </Typography>
                    </>
                  )}

                  {/* Student's Thesis PDF */}
                  {thesis.studentPdfUrl && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>
                        Student's Thesis PDF
                      </Typography>
                      <Box sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<PictureAsPdfIcon />}
                          href={`${api.defaults.baseURL}${thesis.studentPdfUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ mb: 1 }}
                        >
                          View Student PDF
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => setPdfPreview(prev => ({ ...prev, [`student-${thesis.id}`]: !prev[`student-${thesis.id}`] }))}
                          sx={{ ml: 2 }}
                        >
                          {pdfPreview[`student-${thesis.id}`] ? 'Hide Preview' : 'Preview Student PDF'}
                        </Button>
                        {pdfPreview[`student-${thesis.id}`] && (
                          <iframe
                            src={`${api.defaults.baseURL}${thesis.studentPdfUrl}`}
                            width="100%"
                            height="500px"
                            style={{ border: '1px solid #ccc', borderRadius: 4, marginTop: 8 }}
                            title={`Student Thesis PDF ${thesis.id}`}
                          />
                        )}
                      </Box>
                    </>
                  )}

                  {/* Grading Section */}
                  {thesis.status === ThesisStatus.ASSIGNED && thesis.studentPdfUrl && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" gutterBottom>
                        Grading
                      </Typography>
                      
                      {/* Marks Display */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Main Faculty Mark:</strong> {thesis.mainFacultyMark !== null ? `${thesis.mainFacultyMark}/10` : 'Not graded'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Supervisor 1 Mark:</strong> {thesis.supervisor1Mark !== null ? `${thesis.supervisor1Mark}/10` : 'Not graded'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Supervisor 2 Mark:</strong> {thesis.supervisor2Mark !== null ? `${thesis.supervisor2Mark}/10` : 'Not graded'}
                        </Typography>
                        {thesis.finalMark !== null && thesis.finalMark !== undefined && (
                          <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mt: 1 }}>
                            <strong>Final Mark:</strong> {thesis.finalMark.toFixed(2)}/10
                          </Typography>
                        )}
                      </Box>

                      {/* Grading Button */}
                      {canGradeThesis(thesis) && !hasGraded(thesis) && (
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<GradeIcon />}
                          onClick={() => {
                            setThesisToGrade(thesis);
                            setGrade(0);
                            setGradingDialogOpen(true);
                          }}
                        >
                          Grade Thesis
                        </Button>
                      )}
                      
                      {canGradeThesis(thesis) && hasGraded(thesis) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                          <GradeIcon color="success" sx={{ mr: 1 }} />
                          <Typography color="success.main" fontWeight="bold">
                            Already Graded
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}

                  {/* Status Messages */}
                  {thesis.status === ThesisStatus.COMPLETED && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                        ✓ Thesis completed and graded!
                      </Typography>
                    </Box>
                  )}
                  {thesis.status === ThesisStatus.ASSIGNED && thesis.studentPdfUrl && (() => {
                    const acceptedSupervisors = thesis.supervisingFaculty.filter((faculty: any) => faculty.status === 'ACCEPTED');
                    const hasMainFacultyMark = thesis.mainFacultyMark !== null;
                    const hasSupervisor1Mark = thesis.supervisor1Mark !== null;
                    const hasSupervisor2Mark = thesis.supervisor2Mark !== null;
                    
                    if (acceptedSupervisors.length === 1) {
                      if (hasMainFacultyMark && hasSupervisor1Mark) {
                        return (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
                            All required graders have graded. Thesis will be completed soon.
                          </Typography>
                        );
                      } else {
                        return (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
                            Waiting for {!hasMainFacultyMark ? 'main faculty' : 'supervisor'} to grade.
                          </Typography>
                        );
                      }
                    } else if (acceptedSupervisors.length === 2) {
                      if (hasMainFacultyMark && hasSupervisor1Mark && hasSupervisor2Mark) {
                        return (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
                            All required graders have graded. Thesis will be completed soon.
                          </Typography>
                        );
                      } else {
                        const missingGraders = [];
                        if (!hasMainFacultyMark) missingGraders.push('main faculty');
                        if (!hasSupervisor1Mark) missingGraders.push('supervisor 1');
                        if (!hasSupervisor2Mark) missingGraders.push('supervisor 2');
                        
                        return (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
                            Waiting for {missingGraders.join(' and ')} to grade.
                          </Typography>
                        );
                      }
                    }
                    
                    return (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
                        Waiting for supervisors to accept invitations and grade the thesis.
                      </Typography>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {myTheses
              .filter(thesis => thesis.status === ThesisStatus.OPEN)
              .map((thesis) => (
                <Card key={thesis.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6">{thesis.title}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: getStatusColor(thesis.status),
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            border: 1,
                            borderColor: getStatusColor(thesis.status),
                          }}
                        >
                          {thesis.status}
                        </Typography>
                        {thesis.facultyId === user?.id && (
                          <>
                            <Button
                              startIcon={<EditIcon />}
                              onClick={() => {
                                setEditingThesis(thesis);
                                setEditDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              startIcon={<DeleteIcon />}
                              color="error"
                              onClick={() => {
                                setThesisToDelete(thesis.id);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </Box>
                    </Box>
                    <Typography color="textSecondary" paragraph>
                      {thesis.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Faculty:</strong> {thesis.faculty.fullName}
                      {thesis.facultyId === user?.id && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            ml: 1,
                            px: 1,
                            py: 0.5,
                            bgcolor: 'primary.main',
                            color: 'white',
                            borderRadius: 1,
                            fontSize: '0.7rem',
                          }}
                        >
                          MAIN FACULTY
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Supervising Faculty: </strong> 
                      {thesis.supervisingFaculty.length > 0 ? (
                        thesis.supervisingFaculty.map((faculty: any, index: number) => {
                          return (
                            <span key={faculty.id}>
                              {faculty.fullName}
                              {faculty.id === user?.id && faculty.status === 'ACCEPTED' && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'secondary.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  SUPERVISOR
                                </Typography>
                              )}
                              {faculty.status === 'ACCEPTED' && faculty.id !== user?.id && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'success.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  SUPERVISOR
                                </Typography>
                              )}
                              {faculty.status === 'PENDING' && faculty.id !== user?.id && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'warning.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  PENDING
                                </Typography>
                              )}
                              {faculty.status === 'REJECTED' && faculty.id !== user?.id && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  REJECTED
                                </Typography>
                              )}
                              {index < thesis.supervisingFaculty.length - 1 && ', '}
                            </span>
                          );
                        })
                      ) : (
                        'None'
                      )}
                    </Typography>
                    {thesis.pdfUrl && (
                      <Box sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<PictureAsPdfIcon />}
                          href={`${api.defaults.baseURL}${thesis.pdfUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ mb: 1 }}
                        >
                          View PDF
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => setPdfPreview(prev => ({ ...prev, [thesis.id]: !prev[thesis.id] }))}
                          sx={{ ml: 2 }}
                        >
                          {pdfPreview[thesis.id] ? 'Hide Preview' : 'Preview PDF'}
                        </Button>
                        {pdfPreview[thesis.id] && (
                          <iframe
                            src={`${api.defaults.baseURL}${thesis.pdfUrl}`}
                            width="100%"
                            height="500px"
                            style={{ border: '1px solid #ccc', borderRadius: 4, marginTop: 8 }}
                            title={`Thesis PDF ${thesis.id}`}
                          />
                        )}
                      </Box>
                    )}
                    
                    {thesis.selectedBy && thesis.selectedBy.length > 0 && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" gutterBottom>
                          Students who selected this thesis:
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell align="right">Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {thesis.selectedBy.map((student) => (
                                <TableRow key={student.id}>
                                  <TableCell>{student.fullName}</TableCell>
                                  <TableCell>{student.email}</TableCell>
                                  <TableCell align="right">
                                    {thesis.facultyId === user?.id && thesis.status === ThesisStatus.OPEN && (
                                      <Button
                                        size="small"
                                        color="primary"
                                        onClick={() => handleAssignThesis(thesis.id, student.id)}
                                      >
                                        Assign Thesis
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {myTheses
              .filter(thesis => thesis.status === ThesisStatus.ASSIGNED)
              .map((thesis) => (
                <Card key={thesis.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6">{thesis.title}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: getStatusColor(thesis.status),
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            border: 1,
                            borderColor: getStatusColor(thesis.status),
                          }}
                        >
                          {thesis.status}
                        </Typography>
                        {thesis.facultyId === user?.id && (
                          <>
                            <Button
                              startIcon={<EditIcon />}
                              onClick={() => {
                                setEditingThesis(thesis);
                                setEditDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              startIcon={<DeleteIcon />}
                              color="error"
                              onClick={() => {
                                setThesisToDelete(thesis.id);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </Box>
                    </Box>
                    <Typography color="textSecondary" paragraph>
                      {thesis.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Faculty:</strong> {thesis.faculty.fullName}
                      {thesis.facultyId === user?.id && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            ml: 1,
                            px: 1,
                            py: 0.5,
                            bgcolor: 'primary.main',
                            color: 'white',
                            borderRadius: 1,
                            fontSize: '0.7rem',
                          }}
                        >
                          MAIN FACULTY
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Supervising Faculty: </strong> 
                      {thesis.supervisingFaculty.length > 0 ? (
                        thesis.supervisingFaculty.map((faculty: any, index: number) => {
                          return (
                            <span key={faculty.id}>
                              {faculty.fullName}
                              {faculty.id === user?.id && faculty.status === 'ACCEPTED' && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'secondary.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  SUPERVISOR
                                </Typography>
                              )}
                              {faculty.status === 'ACCEPTED' && faculty.id !== user?.id && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'success.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  SUPERVISOR
                                </Typography>
                              )}
                              {faculty.status === 'PENDING' && faculty.id !== user?.id && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'warning.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  PENDING
                                </Typography>
                              )}
                              {faculty.status === 'REJECTED' && faculty.id !== user?.id && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  REJECTED
                                </Typography>
                              )}
                              {index < thesis.supervisingFaculty.length - 1 && ', '}
                            </span>
                          );
                        })
                      ) : (
                        'None'
                      )}
                    </Typography>
                    {thesis.pdfUrl && (
                      <Box sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<PictureAsPdfIcon />}
                          href={`${api.defaults.baseURL}${thesis.pdfUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ mb: 1 }}
                        >
                          View PDF
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => setPdfPreview(prev => ({ ...prev, [thesis.id]: !prev[thesis.id] }))}
                          sx={{ ml: 2 }}
                        >
                          {pdfPreview[thesis.id] ? 'Hide Preview' : 'Preview PDF'}
                        </Button>
                        {pdfPreview[thesis.id] && (
                          <iframe
                            src={`${api.defaults.baseURL}${thesis.pdfUrl}`}
                            width="100%"
                            height="500px"
                            style={{ border: '1px solid #ccc', borderRadius: 4, marginTop: 8 }}
                            title={`Thesis PDF ${thesis.id}`}
                          />
                        )}
                      </Box>
                    )}
                    {thesis.assignedTo && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1">
                          Assigned to: {thesis.assignedTo.fullName}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {myTheses
              .filter(thesis => thesis.status === ThesisStatus.COMPLETED)
              .map((thesis) => (
                <Card key={thesis.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6">{thesis.title}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: getStatusColor(thesis.status),
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            border: 1,
                            borderColor: getStatusColor(thesis.status),
                          }}
                        >
                          {thesis.status}
                        </Typography>
                        {thesis.facultyId === user?.id && (
                          <>
                            <Button
                              startIcon={<EditIcon />}
                              onClick={() => {
                                setEditingThesis(thesis);
                                setEditDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              startIcon={<DeleteIcon />}
                              color="error"
                              onClick={() => {
                                setThesisToDelete(thesis.id);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </Box>
                    </Box>
                    <Typography color="textSecondary" paragraph>
                      {thesis.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Faculty:</strong> {thesis.faculty.fullName}
                      {thesis.facultyId === user?.id && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            ml: 1,
                            px: 1,
                            py: 0.5,
                            bgcolor: 'primary.main',
                            color: 'white',
                            borderRadius: 1,
                            fontSize: '0.7rem',
                          }}
                        >
                          MAIN FACULTY
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Supervising Faculty: </strong> 
                      {thesis.supervisingFaculty.length > 0 ? (
                        thesis.supervisingFaculty.map((faculty: any, index: number) => {
                          return (
                            <span key={faculty.id}>
                              {faculty.fullName}
                              {faculty.id === user?.id && faculty.status === 'ACCEPTED' && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'secondary.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  SUPERVISOR
                                </Typography>
                              )}
                              {faculty.status === 'ACCEPTED' && faculty.id !== user?.id && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'success.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  SUPERVISOR
                                </Typography>
                              )}
                              {faculty.status === 'PENDING' && faculty.id !== user?.id && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'warning.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  PENDING
                                </Typography>
                              )}
                              {faculty.status === 'REJECTED' && faculty.id !== user?.id && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    ml: 1,
                                    px: 1,
                                    py: 0.5,
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    borderRadius: 1,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  REJECTED
                                </Typography>
                              )}
                              {index < thesis.supervisingFaculty.length - 1 && ', '}
                            </span>
                          );
                        })
                      ) : (
                        'None'
                      )}
                    </Typography>
                    {thesis.pdfUrl && (
                      <Box sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<PictureAsPdfIcon />}
                          href={`${api.defaults.baseURL}${thesis.pdfUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ mb: 1 }}
                        >
                          View PDF
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => setPdfPreview(prev => ({ ...prev, [thesis.id]: !prev[thesis.id] }))}
                          sx={{ ml: 2 }}
                        >
                          {pdfPreview[thesis.id] ? 'Hide Preview' : 'Preview PDF'}
                        </Button>
                        {pdfPreview[thesis.id] && (
                          <iframe
                            src={`${api.defaults.baseURL}${thesis.pdfUrl}`}
                            width="100%"
                            height="500px"
                            style={{ border: '1px solid #ccc', borderRadius: 4, marginTop: 8 }}
                            title={`Thesis PDF ${thesis.id}`}
                          />
                        )}
                      </Box>
                    )}
                    {thesis.assignedTo && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1">
                          Completed by: {thesis.assignedTo.fullName}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
          </Box>
        </TabPanel>
      </Paper>

      {/* Create Thesis Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setNewThesis({ title: '', description: '' });
          setSelectedFile(null);
        }}
      >
        <DialogTitle>Create New Thesis</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              fullWidth
              label="Title"
              value={newThesis.title}
              onChange={(e) => setNewThesis(prev => ({ ...prev, title: e.target.value }))}
              required
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={4}
              value={newThesis.description}
              onChange={(e) => setNewThesis(prev => ({ ...prev, description: e.target.value }))}
              required
            />
            <Box>
              <input
                accept="application/pdf"
                style={{ display: 'none' }}
                id="pdf-upload"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                  }
                }}
              />
              <label htmlFor="pdf-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                >
                  Upload PDF
                </Button>
              </label>
              {selectedFile && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Selected file: {selectedFile.name}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setNewThesis({ title: '', description: '' });
            setSelectedFile(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateThesis} 
            variant="contained"
            disabled={!newThesis.title || !newThesis.description}
          >
            Create Thesis
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Thesis Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingThesis(null);
          setSelectedFile(null);
        }}
      >
        <DialogTitle>Edit Thesis</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              fullWidth
              label="Title"
              value={editingThesis?.title || ''}
              onChange={(e) => setEditingThesis(prev => prev ? { ...prev, title: e.target.value } : null)}
              required
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={4}
              value={editingThesis?.description || ''}
              onChange={(e) => setEditingThesis(prev => prev ? { ...prev, description: e.target.value } : null)}
              required
            />
            <Box>
              <input
                accept="application/pdf"
                style={{ display: 'none' }}
                id="pdf-upload-edit"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                  }
                }}
              />
              <label htmlFor="pdf-upload-edit">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                >
                  {editingThesis?.pdfUrl ? 'Change PDF' : 'Upload PDF'}
                </Button>
              </label>
              {selectedFile && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Selected file: {selectedFile.name}
                </Typography>
              )}
              {editingThesis?.pdfUrl && !selectedFile && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Current PDF: {editingThesis.pdfUrl.split('/').pop()}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEditingThesis(null);
            setSelectedFile(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleEditThesis} 
            variant="contained"
            disabled={!editingThesis?.title || !editingThesis?.description}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setThesisToDelete(null);
        }}
      >
        <DialogTitle>Delete Thesis</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this thesis? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteConfirmOpen(false);
            setThesisToDelete(null);
          }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteThesis} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pending Invitations Section */}
      {pendingInvitations.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Pending Invitations
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {pendingInvitations.map((thesis) => (
              <Box key={thesis.id} sx={{ width: '100%', mb: 2 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" component="h3">
                      {thesis.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {thesis.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Faculty:</strong> {thesis.faculty.fullName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Your Role:</strong> 
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          ml: 1,
                          px: 1,
                          py: 0.5,
                          bgcolor: 'warning.main',
                          color: 'white',
                          borderRadius: 1,
                          fontSize: '0.7rem',
                        }}
                      >
                        PENDING SUPERVISOR
                      </Typography>
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleAcceptInvitation(thesis.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={() => handleRejectInvitation(thesis.id)}
                      >
                        Reject
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Grading Dialog */}
      <Dialog
        open={gradingDialogOpen}
        onClose={() => {
          setGradingDialogOpen(false);
          setThesisToGrade(null);
          setGrade(0);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Grade Thesis</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {thesisToGrade && (
              <>
                <Typography variant="h6">{thesisToGrade.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Student: {thesisToGrade.assignedTo?.fullName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your Role: {getFacultyRole(thesisToGrade) === 'MAIN_FACULTY' ? 'Main Faculty' : 
                    getFacultyRole(thesisToGrade) === 'SUPERVISOR_1' ? 'Supervisor (1st)' :
                    getFacultyRole(thesisToGrade) === 'SUPERVISOR_2' ? 'Supervisor (2nd)' : 'Supervisor'}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" gutterBottom>
                  Rate the thesis (0-10)
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Rating
                    value={grade}
                    onChange={(event, newValue) => {
                      setGrade(newValue || 0);
                    }}
                    max={10}
                    precision={0.5}
                    size="large"
                  />
                  <Typography variant="h6" color="primary">
                    {grade}/10
                  </Typography>
                </Box>
                
                <TextField
                  type="number"
                  label="Mark"
                  value={grade}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value >= 0 && value <= 10) {
                      setGrade(value);
                    }
                  }}
                  inputProps={{
                    min: 0,
                    max: 10,
                    step: 0.5,
                  }}
                  fullWidth
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setGradingDialogOpen(false);
            setThesisToGrade(null);
            setGrade(0);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleGradeThesis} 
            variant="contained"
            disabled={grading || grade === 0}
          >
            {grading ? 'Grading...' : 'Submit Grade'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FacultyDashboard; 