import React, { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  Box,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import UploadIcon from '@mui/icons-material/Upload';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Thesis, User } from '../types';

export const ThesisManagement: React.FC = () => {
  const { user, logout } = useAuth();
  const [availableTheses, setAvailableTheses] = useState<Thesis[]>([]);
  const [selectedThesis, setSelectedThesis] = useState<Thesis | null>(null);
  const [assignedThesis, setAssignedThesis] = useState<Thesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ [key: string]: boolean }>({});
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [facultyMembers, setFacultyMembers] = useState<User[]>([]);
  const [selectedSupervisorToInvite, setSelectedSupervisorToInvite] = useState<User | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load available theses (OPEN status)
      const thesesResponse = await api.get<Thesis[]>('/theses');
      const theses = thesesResponse.data; // Direct array, not wrapped in a data property
      const openTheses = theses.filter((t: Thesis) => t.status === 'OPEN');
      setAvailableTheses(openTheses);

      // Load student's selected thesis
      const selectedThesis = openTheses.find((t: Thesis) => 
        t.selectedBy && t.selectedBy.some((s: User) => s.id === user?.id)
      );
      setSelectedThesis(selectedThesis || null);

      // Load student's assigned thesis
      const assignedThesis = theses.find((t: Thesis) => 
        t.assignedToId === user?.id
      );
      setAssignedThesis(assignedThesis || null);
    } catch (err) {
      setError('Failed to load data. Please try again later.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
    // Load faculty members for supervisor invitation
    const loadFaculty = async () => {
      const facultyResponse = await api.get<User[]>('/users?role=FACULTY');
      setFacultyMembers(facultyResponse.data);
    };
    loadFaculty();
  }, [user?.id]);

  const handleSelectThesis = async (thesisId: number) => {
    try {
      setError(null);
      await api.post(`/theses/${thesisId}/select`);
      await loadData();
    } catch (err) {
      setError('Failed to select thesis. Please try again later.');
      console.error('Error selecting thesis:', err);
    }
  };

  const handleUnselectThesis = async (thesisId: number) => {
    try {
      setError(null);
      await api.post(`/theses/${thesisId}/unselect`);
      await loadData();
    } catch (err) {
      setError('Failed to unselect thesis. Please try again later.');
      console.error('Error unselecting thesis:', err);
    }
  };

  const handleUploadThesis = async () => {
    if (!selectedFile || !assignedThesis) return;

    try {
      setUploading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('thesisPdf', selectedFile);

      await api.post(`/theses/${assignedThesis.id}/upload-student-thesis`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadDialogOpen(false);
      setSelectedFile(null);
      await loadData();
    } catch (err) {
      setError('Failed to upload thesis. Please try again later.');
      console.error('Error uploading thesis:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleInviteSupervisor = async () => {
    if (!assignedThesis || !selectedSupervisorToInvite) return;
    try {
      await api.post(`/theses/${assignedThesis.id}/invite-supervisor`, { facultyId: selectedSupervisorToInvite.id });
      setSelectedSupervisorToInvite(null);
      await loadData();
    } catch (err) {
      setError('Failed to invite supervisor.');
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
          Thesis Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => window.location.href = '/profile'}
          >
            Profile
          </Button>
          <Button
            variant="contained"
            color="primary"
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

      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Assigned Thesis Section */}
          <Box>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Your Assigned Thesis
              </Typography>
              {assignedThesis ? (
                <Card>
                  <CardContent>
                    <Typography variant="h6">{assignedThesis.title}</Typography>
                    <Typography color="textSecondary" gutterBottom>
                      Status: {assignedThesis.status}
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {assignedThesis.description}
                    </Typography>
                    
                    {/* Faculty Information */}
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Faculty Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Main Faculty:</strong> {assignedThesis.faculty.fullName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Supervising Faculty: </strong> 
                      {assignedThesis.supervisingFaculty.length > 0 ? (
                        assignedThesis.supervisingFaculty.map((faculty: any, index: number) => (
                          <span key={faculty.id}>
                            {faculty.fullName}
                            {faculty.status === 'ACCEPTED' && (
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
                                ACCEPTED
                              </Typography>
                            )}
                            {faculty.status === 'PENDING' && (
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
                            {index < assignedThesis.supervisingFaculty.length - 1 && ', '}
                          </span>
                        ))
                      ) : (
                        'None'
                      )}
                    </Typography>

                    {/* Original Thesis PDF */}
                    {assignedThesis.pdfUrl && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" gutterBottom>
                          Original Thesis PDF
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Button
                            variant="outlined"
                            startIcon={<PictureAsPdfIcon />}
                            href={`${api.defaults.baseURL}${assignedThesis.pdfUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ mb: 1 }}
                          >
                            View Original PDF
                          </Button>
                          <Button
                            variant="text"
                            onClick={() => setPdfPreview(prev => ({ ...prev, [assignedThesis.id]: !prev[assignedThesis.id] }))}
                            sx={{ ml: 2 }}
                          >
                            {pdfPreview[assignedThesis.id] ? 'Hide Preview' : 'Preview Original PDF'}
                          </Button>
                          {pdfPreview[assignedThesis.id] && (
                            <iframe
                              src={`${api.defaults.baseURL}${assignedThesis.pdfUrl}`}
                              width="100%"
                              height="500px"
                              style={{ border: '1px solid #ccc', borderRadius: 4, marginTop: 8 }}
                              title={`Original Thesis PDF ${assignedThesis.id}`}
                            />
                          )}
                        </Box>
                      </>
                    )}

                    {/* Student's Thesis PDF */}
                    {assignedThesis.studentPdfUrl && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" gutterBottom>
                          Your Thesis PDF
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Button
                            variant="outlined"
                            startIcon={<PictureAsPdfIcon />}
                            href={`${api.defaults.baseURL}${assignedThesis.studentPdfUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ mb: 1 }}
                          >
                            View Your PDF
                          </Button>
                          <Button
                            variant="text"
                            onClick={() => setPdfPreview(prev => ({ ...prev, [`student-${assignedThesis.id}`]: !prev[`student-${assignedThesis.id}`] }))}
                            sx={{ ml: 2 }}
                          >
                            {pdfPreview[`student-${assignedThesis.id}`] ? 'Hide Preview' : 'Preview Your PDF'}
                          </Button>
                          {pdfPreview[`student-${assignedThesis.id}`] && (
                            <iframe
                              src={`${api.defaults.baseURL}${assignedThesis.studentPdfUrl}`}
                              width="100%"
                              height="500px"
                              style={{ border: '1px solid #ccc', borderRadius: 4, marginTop: 8 }}
                              title={`Student Thesis PDF ${assignedThesis.id}`}
                            />
                          )}
                        </Box>
                      </>
                    )}

                    {/* Grading Section */}
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Your Grades
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Main Faculty Mark:</strong> {assignedThesis.mainFacultyMark !== null ? `${assignedThesis.mainFacultyMark}/10` : 'Not graded yet'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Supervisor 1 Mark:</strong> {assignedThesis.supervisor1Mark !== null ? `${assignedThesis.supervisor1Mark}/10` : 'Not graded yet'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Supervisor 2 Mark:</strong> {assignedThesis.supervisor2Mark !== null ? `${assignedThesis.supervisor2Mark}/10` : 'Not graded yet'}
                      </Typography>
                      {assignedThesis.finalMark !== null && assignedThesis.finalMark !== undefined && (
                        <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mt: 1 }}>
                          <strong>Final Mark:</strong> {assignedThesis.finalMark.toFixed(2)}/10
                        </Typography>
                      )}
                      {assignedThesis.mainFacultyMark === null && assignedThesis.supervisor1Mark === null && assignedThesis.supervisor2Mark === null && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          Your thesis will be graded by the main faculty member and supervisors once they review your submission.
                        </Typography>
                      )}
                    </Box>

                    {/* Invite Supervisors Section */}
                    {assignedThesis && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" gutterBottom>
                          Invite Supervisors
                        </Typography>
                        {assignedThesis.supervisingFaculty.length < 2 ? (
                          <Box sx={{ mb: 2 }}>
                            <Autocomplete
                              multiple={false}
                              options={facultyMembers.filter(f => 
                                f.id !== assignedThesis.facultyId && 
                                !assignedThesis.supervisingFaculty.some((sf: any) => sf.id === f.id)
                              )}
                              getOptionLabel={(option) => option.fullName}
                              value={selectedSupervisorToInvite}
                              onChange={(_, newValue) => setSelectedSupervisorToInvite(newValue)}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Select Faculty to Invite"
                                  helperText="You can invite up to 2 supervisors."
                                />
                              )}
                              isOptionEqualToValue={(option, value) => option.id === value.id}
                            />
                            <Button
                              variant="contained"
                              sx={{ mt: 1 }}
                              disabled={!selectedSupervisorToInvite}
                              onClick={handleInviteSupervisor}
                            >
                              Invite Supervisor
                            </Button>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            You have invited the maximum number of supervisors.
                          </Typography>
                        )}
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Invited Supervisors:</strong>
                            {assignedThesis.supervisingFaculty.length > 0 ? (
                              assignedThesis.supervisingFaculty.map((faculty: any, index: number) => (
                                <span key={faculty.id}>
                                  {faculty.fullName}
                                  {faculty.status === 'ACCEPTED' && (
                                    <Typography
                                      component="span"
                                      variant="caption"
                                      sx={{ ml: 1, px: 1, py: 0.5, bgcolor: 'success.main', color: 'white', borderRadius: 1, fontSize: '0.7rem' }}
                                    >
                                      ACCEPTED
                                    </Typography>
                                  )}
                                  {faculty.status === 'PENDING' && (
                                    <Typography
                                      component="span"
                                      variant="caption"
                                      sx={{ ml: 1, px: 1, py: 0.5, bgcolor: 'warning.main', color: 'white', borderRadius: 1, fontSize: '0.7rem' }}
                                    >
                                      PENDING
                                    </Typography>
                                  )}
                                  {faculty.status === 'REJECTED' && (
                                    <Typography
                                      component="span"
                                      variant="caption"
                                      sx={{ ml: 1, px: 1, py: 0.5, bgcolor: 'error.main', color: 'white', borderRadius: 1, fontSize: '0.7rem' }}
                                    >
                                      REJECTED
                                    </Typography>
                                  )}
                                  {index < assignedThesis.supervisingFaculty.length - 1 && ', '}
                                </span>
                              ))
                            ) : (
                              ' None'
                            )}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button 
                      variant="contained"
                      startIcon={<UploadIcon />}
                      onClick={() => setUploadDialogOpen(true)}
                    >
                      Upload Your Thesis PDF
                    </Button>
                  </CardActions>
                </Card>
              ) : (
                <Typography color="textSecondary">
                  You haven't been assigned a thesis yet.
                </Typography>
              )}
            </Paper>
          </Box>

          {/* Selected Thesis Section */}
          <Box>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Your Selected Thesis
              </Typography>
              {selectedThesis ? (
                <Card>
                  <CardContent>
                    <Typography variant="h6">{selectedThesis.title}</Typography>
                    <Typography color="textSecondary" gutterBottom>
                      Status: {selectedThesis.status}
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {selectedThesis.description}
                    </Typography>
                    
                    {/* Faculty Information */}
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Faculty Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Main Faculty:</strong> {selectedThesis.faculty.fullName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Supervising Faculty: </strong> 
                      {selectedThesis.supervisingFaculty.length > 0 ? (
                        selectedThesis.supervisingFaculty.map((faculty: any, index: number) => (
                          <span key={faculty.id}>
                            {faculty.fullName}
                            {faculty.status === 'ACCEPTED' && (
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
                                ACCEPTED
                              </Typography>
                            )}
                            {faculty.status === 'PENDING' && (
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
                            {index < selectedThesis.supervisingFaculty.length - 1 && ', '}
                          </span>
                        ))
                      ) : (
                        'None'
                      )}
                    </Typography>

                    {/* Original Thesis PDF */}
                    {selectedThesis.pdfUrl && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" gutterBottom>
                          Original Thesis PDF
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Button
                            variant="outlined"
                            startIcon={<PictureAsPdfIcon />}
                            href={`${api.defaults.baseURL}${selectedThesis.pdfUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ mb: 1 }}
                          >
                            View Original PDF
                          </Button>
                          <Button
                            variant="text"
                            onClick={() => setPdfPreview(prev => ({ ...prev, [selectedThesis.id]: !prev[selectedThesis.id] }))}
                            sx={{ ml: 2 }}
                          >
                            {pdfPreview[selectedThesis.id] ? 'Hide Preview' : 'Preview Original PDF'}
                          </Button>
                          {pdfPreview[selectedThesis.id] && (
                            <iframe
                              src={`${api.defaults.baseURL}${selectedThesis.pdfUrl}`}
                              width="100%"
                              height="500px"
                              style={{ border: '1px solid #ccc', borderRadius: 4, marginTop: 8 }}
                              title={`Original Thesis PDF ${selectedThesis.id}`}
                            />
                          )}
                        </Box>
                      </>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button 
                      color="error" 
                      onClick={() => handleUnselectThesis(selectedThesis.id)}
                    >
                      Unselect Thesis
                    </Button>
                  </CardActions>
                </Card>
              ) : (
                <Typography color="textSecondary">
                  You haven't selected a thesis yet.
                </Typography>
              )}
            </Paper>
          </Box>

          {/* Available Theses Section */}
          <Box>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Available Theses
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {availableTheses.map((thesis) => (
                  <Box key={thesis.id} sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' } }}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6">{thesis.title}</Typography>
                        <Typography variant="body1" paragraph>
                          {thesis.description}
                        </Typography>
                        
                        {/* Faculty Information */}
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          <strong>Main Faculty:</strong> {thesis.faculty.fullName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          <strong>Supervising Faculty: </strong> 
                          {thesis.supervisingFaculty.length > 0 ? (
                            thesis.supervisingFaculty.map((faculty: any, index: number) => (
                              <span key={faculty.id}>
                                {faculty.fullName}
                                {faculty.status === 'ACCEPTED' && (
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
                                    ACCEPTED
                                  </Typography>
                                )}
                                {faculty.status === 'PENDING' && (
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
                                {index < thesis.supervisingFaculty.length - 1 && ', '}
                              </span>
                            ))
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
                      </CardContent>
                      <CardActions>
                        <Button 
                          color="primary"
                          onClick={() => handleSelectThesis(thesis.id)}
                          disabled={!!selectedThesis}
                        >
                          Select Thesis
                        </Button>
                      </CardActions>
                    </Card>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* Upload Thesis PDF Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => {
          setUploadDialogOpen(false);
          setSelectedFile(null);
        }}
      >
        <DialogTitle>Upload Your Thesis PDF</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Box>
              <input
                accept="application/pdf"
                style={{ display: 'none' }}
                id="student-thesis-upload"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                  }
                }}
              />
              <label htmlFor="student-thesis-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                >
                  Choose PDF File
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
            setUploadDialogOpen(false);
            setSelectedFile(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleUploadThesis} 
            variant="contained"
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Thesis'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ThesisManagement; 