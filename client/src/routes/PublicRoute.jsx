import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicRoute({ children }) {
  const { currentUser, authLoading } = useAuth();
  
  if (authLoading) {
    return null;
  }

  const isAuth = !!currentUser;
  
  return isAuth ? <Navigate to="/dashboard" replace /> : children;
}
