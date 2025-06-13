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
  Chip,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Thesis } from '../types';

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

export const FacultyDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [myTheses, setMyTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newThesis, setNewThesis] = useState({ title: '', description: '' });
  const [tabValue, setTabValue] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<Thesis[]>('/theses');
      const theses = response.data;
      const facultyTheses = theses.filter(t => t.facultyId === user?.id);
      setMyTheses(facultyTheses);
    } catch (err) {
      setError('Failed to load theses. Please try again later.');
      console.error('Error loading theses:', err);
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
      await api.post('/theses', newThesis);
      setCreateDialogOpen(false);
      setNewThesis({ title: '', description: '' });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'primary';
      case 'ASSIGNED':
        return 'success';
      case 'COMPLETED':
        return 'info';
      default:
        return 'default';
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
              <Card key={thesis.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6">{thesis.title}</Typography>
                    <Chip 
                      label={thesis.status} 
                      color={getStatusColor(thesis.status)}
                      size="small"
                    />
                  </Box>
                  <Typography color="textSecondary" paragraph>
                    {thesis.description}
                  </Typography>
                  
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
                <Card key={thesis.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6">{thesis.title}</Typography>
                      <Chip 
                        label={thesis.status} 
                        color={getStatusColor(thesis.status)}
                        size="small"
                      />
                    </Box>
                    <Typography color="textSecondary" paragraph>
                      {thesis.description}
                    </Typography>
                    
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
                <Card key={thesis.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6">{thesis.title}</Typography>
                      <Chip 
                        label={thesis.status} 
                        color={getStatusColor(thesis.status)}
                        size="small"
                      />
                    </Box>
                    <Typography color="textSecondary" paragraph>
                      {thesis.description}
                    </Typography>
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
                <Card key={thesis.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6">{thesis.title}</Typography>
                      <Chip 
                        label={thesis.status} 
                        color={getStatusColor(thesis.status)}
                        size="small"
                      />
                    </Box>
                    <Typography color="textSecondary" paragraph>
                      {thesis.description}
                    </Typography>
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
        onClose={() => setCreateDialogOpen(false)}
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateThesis}
            disabled={!newThesis.title || !newThesis.description}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FacultyDashboard; 