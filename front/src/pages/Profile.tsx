import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  TextField,
  Alert,
  Divider,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  studentId?: string;
  postalAddress?: string;
  mobilePhone?: string;
  landlinePhone?: string;
  createdAt: string;
  updatedAt: string;
}

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    studentId: '',
    postalAddress: '',
    mobilePhone: '',
    landlinePhone: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<UserProfile>('/users/profile');
      setProfile(response.data);
      setFormData({
        fullName: response.data.fullName,
        email: response.data.email,
        studentId: response.data.studentId || '',
        postalAddress: response.data.postalAddress || '',
        mobilePhone: response.data.mobilePhone || '',
        landlinePhone: response.data.landlinePhone || '',
      });
    } catch (err) {
      setError('Failed to load profile. Please try again later.');
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await api.put<UserProfile>('/users/profile', formData);
      setProfile(response.data);
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile. Please try again later.');
      console.error('Error updating profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleBackToDashboard = () => {
    if (!user) return;
    
    switch (user.role) {
      case 'STUDENT':
        window.location.href = '/thesis';
        break;
      case 'FACULTY':
        window.location.href = '/faculty';
        break;
      case 'SECRETARY':
        window.location.href = '/dashboard';
        break;
      default:
        window.location.href = '/';
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <Container>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Profile Settings
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleBackToDashboard}
          >
            Back to Dashboard
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

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Personal Information
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <TextField
            sx={{ flex: '1 1 200px' }}
            label="Username"
            value={profile?.username || ''}
            disabled
            helperText="Username cannot be changed"
          />
          <TextField
            sx={{ flex: '1 1 200px' }}
            label="Role"
            value={profile?.role || ''}
            disabled
            helperText="Role cannot be changed"
          />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <TextField
            sx={{ flex: '1 1 200px' }}
            label="Full Name"
            value={formData.fullName}
            onChange={(e) => handleInputChange('fullName', e.target.value)}
            required
          />
          <TextField
            sx={{ flex: '1 1 200px' }}
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            required
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            sx={{ width: '100%', maxWidth: '400px' }}
            label="Student ID"
            value={formData.studentId}
            onChange={(e) => handleInputChange('studentId', e.target.value)}
            helperText="Optional - Your student identification number"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Contact Information
        </Typography>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Postal Address"
            multiline
            rows={3}
            value={formData.postalAddress}
            onChange={(e) => handleInputChange('postalAddress', e.target.value)}
            helperText="Optional - Your mailing address"
          />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <TextField
            sx={{ flex: '1 1 200px' }}
            label="Mobile Phone"
            value={formData.mobilePhone}
            onChange={(e) => handleInputChange('mobilePhone', e.target.value)}
            helperText="Optional - Your mobile phone number"
          />
          <TextField
            sx={{ flex: '1 1 200px' }}
            label="Landline Phone"
            value={formData.landlinePhone}
            onChange={(e) => handleInputChange('landlinePhone', e.target.value)}
            helperText="Optional - Your landline phone number"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Account Information
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <TextField
            sx={{ flex: '1 1 200px' }}
            label="Account Created"
            value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ''}
            disabled
          />
          <TextField
            sx={{ flex: '1 1 200px' }}
            label="Last Updated"
            value={profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : ''}
            disabled
          />
        </Box>

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.fullName || !formData.email}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            variant="outlined"
            onClick={loadProfile}
            disabled={saving}
          >
            Cancel
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default Profile; 