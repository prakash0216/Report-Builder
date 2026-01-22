// components/ProtectedRoute.tsx
// Simple protected route wrapper - checks if email exists
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { authState } from '../recoil/AuthState';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const auth = useRecoilValue(authState);

  // Redirect to login if not authenticated
  if (!auth.isAuthenticated || !auth.email) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render children if authenticated
  return <>{children}</>;
};

export default ProtectedRoute;
