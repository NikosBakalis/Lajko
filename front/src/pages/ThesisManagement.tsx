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
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
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
  const [pdfPreview, setPdfPreview] = useState<{ [key: number]: boolean }>({});

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
  }, [loadData]);

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

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
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
        <Button
          variant="contained"
          color="primary"
          onClick={handleLogout}
        >
          Logout
        </Button>
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
                    <Typography variant="body1">
                      {assignedThesis.description}
                    </Typography>
                  </CardContent>
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
                    <Typography variant="body1">
                      {selectedThesis.description}
                    </Typography>
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
                        <Typography variant="body1">
                          {thesis.description}
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
    </Container>
  );
};

export default ThesisManagement; 