import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type React from 'react';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}