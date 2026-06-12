import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Notifications from '../components/Notification';
import { useAuth } from '../context/AuthContext';

import { Box, CircularProgress } from '@mui/material';

export default function ProtectedLayout() {
  const { currentUser, authLoading } = useAuth();
  
  if (authLoading) {
    return (
      <Box sx={{ position: "fixed", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", background: "#0a0a0f", zIndex: 100 }}>
        <CircularProgress sx={{ color: "#ff4081" }} />
      </Box>
    );
  }

  const isAuth = !!currentUser;
  
  return isAuth ? (
    <>
      <Outlet />
      <BottomNav />
      <Notifications />
    </>
  ) : <Navigate to="/login" replace />;
}
