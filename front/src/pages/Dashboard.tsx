import React, { useEffect, useState } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  TextField, 
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  Input,
} from '@mui/material';
import { userApi, User, UserRole, CreateUserData } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user: currentUser, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<CreateUserData>({
    username: '',
    password: '',
    email: '',
    fullName: '',
    role: 'STUDENT' as UserRole
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userApi.getAll();
      setUsers(response.data);
    } catch (error) {
      setError('Failed to load users. Please try again later.');
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);
      await userApi.create(newUser);
      setNewUser({ 
        username: '', 
        password: '', 
        fullName: '', 
        email: '',
        role: 'STUDENT' as UserRole 
      });
      setSuccess('User created successfully!');
      loadData();
    } catch (error) {
      setError('Failed to create user. Please try again later.');
      console.error('Failed to create user:', error);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkUploadFile) {
      setError('Please select a file to upload.');
      return;
    }

    try {
      setBulkUploadLoading(true);
      setError(null);
      setSuccess(null);

      const text = await bulkUploadFile.text();
      let users: CreateUserData[];

      try {
        users = JSON.parse(text);
      } catch (parseError) {
        setError('Invalid JSON format. Please check your file.');
        return;
      }

      if (!Array.isArray(users)) {
        setError('JSON must contain an array of users.');
        return;
      }

      const response = await userApi.bulkCreate(users);
      setSuccess(response.data.message);
      setBulkUploadFile(null);
      loadData();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(`Bulk upload failed: ${error.response.data.error}`);
        if (error.response.data.details) {
          console.error('Upload details:', error.response.data.details);
        }
      } else {
        setError('Failed to upload users. Please try again later.');
      }
      console.error('Failed to upload users:', error);
    } finally {
      setBulkUploadLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        setError('Please select a valid JSON file.');
        return;
      }
      setBulkUploadFile(file);
      setError(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      setError(null);
      setSuccess(null);
      await userApi.delete(userToDelete);
      setSuccess('User deleted successfully!');
      loadData();
    } catch (error) {
      setError('Failed to delete user. Please try again later.');
      console.error('Failed to delete:', error);
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (currentUser?.role !== 'SECRETARY') {
    return (
      <Container>
        <Typography>Access Denied. Secretary access only.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Secretary Dashboard
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
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      
      {/* Users Section */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Users
        </Typography>
        <TableContainer sx={{ maxHeight: 400, overflow: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.filter(user => user.role !== 'SECRETARY').map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    <Button
                      color="error"
                      onClick={() => {
                        setUserToDelete(user.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Bulk Upload Section */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Bulk Upload Users
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload a JSON file with an array of users. Each user should have: username, password, email, fullName, and role (STUDENT or FACULTY).
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Input
            type="file"
            inputProps={{ accept: '.json' }}
            onChange={handleFileChange}
            sx={{ display: 'none' }}
            id="bulk-upload-file"
          />
          <label htmlFor="bulk-upload-file">
            <Button
              variant="outlined"
              component="span"
              disabled={bulkUploadLoading}
            >
              Select JSON File
            </Button>
          </label>
          {bulkUploadFile && (
            <Typography variant="body2" color="primary">
              Selected: {bulkUploadFile.name}
            </Typography>
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={handleBulkUpload}
            disabled={!bulkUploadFile || bulkUploadLoading}
          >
            {bulkUploadLoading ? 'Uploading...' : 'Upload Users'}
          </Button>
        </Box>
      </Paper>

      {/* Create User Form */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Create New User
        </Typography>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Username"
            value={newUser.username}
            onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
            required
          />
          <TextField
            fullWidth
            label="Full Name"
            value={newUser.fullName}
            onChange={(e) => setNewUser(prev => ({ ...prev, fullName: e.target.value }))}
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
            required
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
            required
          />
          <FormControl fullWidth required>
            <InputLabel>Role</InputLabel>
            <Select
              value={newUser.role}
              onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
              label="Role"
            >
              <MenuItem value="STUDENT">Student</MenuItem>
              <MenuItem value="FACULTY">Faculty</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateUser}
            disabled={!newUser.username || !newUser.password || !newUser.email || !newUser.fullName || !newUser.role}
          >
            Create User
          </Button>
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Dashboard; 