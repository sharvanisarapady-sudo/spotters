import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Login/Register: signed-in users go straight to the dashboard. */
export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}
