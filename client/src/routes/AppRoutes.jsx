import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import Messages from '../pages/Messages';
import Home from '../pages/Home';
import Search from '../pages/Search';
import Matches from '../pages/Matches';
import ProtectedLayout from './ProtectedLayout';
import PublicRoute from './PublicRoute';

const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'home', element: <Home /> },
      { path: 'discover', element: <Search /> },
      { path: 'matching', element: <Matches /> },
      { path: 'messages', element: <Messages /> },
    ]
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    )
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <Register />
      </PublicRoute>
    )
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />
  }
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
