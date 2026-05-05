import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#021816] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-roeGreen animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect them to the login page, but save where they were trying to go
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Logged in, but wrong role (e.g., student trying to access admin)
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;