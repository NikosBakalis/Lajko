import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline, CircularProgress } from '@mui/material';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { ThesisManagement } from './pages/ThesisManagement';
import { FacultyDashboard } from './pages/FacultyDashboard';
import Profile from './pages/Profile';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';

function AppRoutes() {
  const { user, loading } = useAuth();

  const getDefaultRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'FACULTY':
        return '/faculty';
      case 'STUDENT':
        return '/thesis';
      case 'SECRETARY':
        return '/dashboard';
      default:
        return '/login';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <CssBaseline />
      <Routes>
        <Route 
          path="/login" 
          element={
            user ? <Navigate to={getDefaultRoute()} replace /> : <Login />
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            !user ? <Navigate to="/login" replace /> :
            user.role === 'SECRETARY' ? <Dashboard /> : 
            <Navigate to={getDefaultRoute()} replace />
          } 
        />
        <Route 
          path="/thesis" 
          element={
            !user ? <Navigate to="/login" replace /> :
            user.role === 'STUDENT' ? <ThesisManagement /> : 
            <Navigate to={getDefaultRoute()} replace />
          } 
        />
        <Route 
          path="/faculty" 
          element={
            !user ? <Navigate to="/login" replace /> :
            user.role === 'FACULTY' ? <FacultyDashboard /> : 
            <Navigate to={getDefaultRoute()} replace />
          } 
        />
        <Route 
          path="/profile" 
          element={
            !user ? <Navigate to="/login" replace /> :
            user.role === 'STUDENT' ? <Profile /> : 
            <Navigate to={getDefaultRoute()} replace />
          } 
        />
        <Route 
          path="/" 
          element={<Navigate to={getDefaultRoute()} replace />} 
        />
      </Routes>
    </Box>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
