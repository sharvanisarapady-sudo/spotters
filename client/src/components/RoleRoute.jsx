import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** UI guard only — the API enforces roles independently. */
export default function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return roles.includes(user.role) ? children : <Navigate to="/dashboard" replace />;
}
