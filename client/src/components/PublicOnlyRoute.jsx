import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Login/Register: signed-in users go straight to their home portal. */
export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin/cases' : '/dashboard'} replace />;
  }
  return children;
}
