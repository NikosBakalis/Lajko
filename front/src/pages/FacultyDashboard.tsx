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
  Autocomplete,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Thesis, User } from '../types';
import UploadIcon from '@mui/icons-material/Upload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

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
  const [pdfPreview, setPdfPreview] = useState<{ [key: number]: boolean }>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingThesis, setEditingThesis] = useState<Thesis | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [thesisToDelete, setThesisToDelete] = useState<number | null>(null);
  const [facultyMembers, setFacultyMembers] = useState<User[]>([]);
  const [selectedSupervisors, setSelectedSupervisors] = useState<User[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<Thesis[]>('/theses');
      const theses = response.data;
      const facultyTheses = theses.filter(t => t.facultyId === user?.id);
      setMyTheses(facultyTheses);

      // Load faculty members for supervisor selection
      const facultyResponse = await api.get<User[]>('/users?role=FACULTY');
      setFacultyMembers(facultyResponse.data.filter(f => f.id !== user?.id));
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
      formData.append('supervisingFacultyIds', JSON.stringify(selectedSupervisors.map(s => s.id)));
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
      setSelectedSupervisors([]);
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
      formData.append('supervisingFacultyIds', JSON.stringify(selectedSupervisors.map(s => s.id)));
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
      setSelectedSupervisors([]);
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
                      <Button
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setEditingThesis(thesis);
                          setSelectedSupervisors(thesis.supervisingFaculty || []);
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
                    </Box>
                  </Box>
                  <Typography color="textSecondary" paragraph>
                    {thesis.description}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <strong>Faculty:</strong> {thesis.faculty.fullName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <strong>Supervising Faculty:</strong> {thesis.supervisingFaculty.map((faculty: any) => faculty.fullName).join(', ') || 'None'}
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
                                  <Button
                                    size="small"
                                    color="primary"
                                    onClick={() => handleAssignThesis(thesis.id, student.id)}
                                  >
                                    Assign Thesis
                                  </Button>
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
                </CardContent>
              </Card>
            ))}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {myTheses
              .filter(thesis => thesis.status === 'OPEN')
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
                        <Button
                          startIcon={<EditIcon />}
                          onClick={() => {
                            setEditingThesis(thesis);
                            setSelectedSupervisors(thesis.supervisingFaculty || []);
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
                      </Box>
                    </Box>
                    <Typography color="textSecondary" paragraph>
                      {thesis.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Faculty:</strong> {thesis.faculty.fullName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Supervising Faculty:</strong> {thesis.supervisingFaculty.map((faculty: any) => faculty.fullName).join(', ') || 'None'}
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
                                    <Button
                                      size="small"
                                      color="primary"
                                      onClick={() => handleAssignThesis(thesis.id, student.id)}
                                    >
                                      Assign Thesis
                                    </Button>
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
              .filter(thesis => thesis.status === 'ASSIGNED')
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
                        <Button
                          startIcon={<EditIcon />}
                          onClick={() => {
                            setEditingThesis(thesis);
                            setSelectedSupervisors(thesis.supervisingFaculty || []);
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
                      </Box>
                    </Box>
                    <Typography color="textSecondary" paragraph>
                      {thesis.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Faculty:</strong> {thesis.faculty.fullName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Supervising Faculty:</strong> {thesis.supervisingFaculty.map((faculty: any) => faculty.fullName).join(', ') || 'None'}
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
              .filter(thesis => thesis.status === 'COMPLETED')
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
                        <Button
                          startIcon={<EditIcon />}
                          onClick={() => {
                            setEditingThesis(thesis);
                            setSelectedSupervisors(thesis.supervisingFaculty || []);
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
                      </Box>
                    </Box>
                    <Typography color="textSecondary" paragraph>
                      {thesis.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Faculty:</strong> {thesis.faculty.fullName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Supervising Faculty:</strong> {thesis.supervisingFaculty.map((faculty: any) => faculty.fullName).join(', ') || 'None'}
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
          setSelectedSupervisors([]);
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
            <Autocomplete
              multiple
              options={facultyMembers}
              getOptionLabel={(option) => option.fullName}
              value={selectedSupervisors}
              onChange={(_, newValue) => setSelectedSupervisors(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Supervising Faculty Members"
                  required
                  helperText="Select exactly 2 faculty members"
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              disableCloseOnSelect
              limitTags={2}
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
            setSelectedSupervisors([]);
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
          setSelectedSupervisors([]);
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
            <Autocomplete
              multiple
              options={facultyMembers}
              getOptionLabel={(option) => option.fullName}
              value={selectedSupervisors}
              onChange={(_, newValue) => setSelectedSupervisors(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Supervising Faculty Members"
                  required
                  helperText="Select exactly 2 faculty members"
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              disableCloseOnSelect
              limitTags={2}
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
            setSelectedSupervisors([]);
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
    </Container>
  );
};

export default FacultyDashboard; 