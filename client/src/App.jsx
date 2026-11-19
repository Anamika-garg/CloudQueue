import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { FullPageLoader } from './components/Spinner';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Admin } from './pages/Admin';
import { ServiceAdmin } from './pages/ServiceAdmin';
import { Display } from './pages/Display';
import { AccessDenied, NotFound } from './pages/NotFound';

function RequireAuth({ children }) {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader message="Checking your session…" />;
  if (!isAuthenticated) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}

function RequireRole({ roles, children }) {
  const { status, isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader message="Checking your permissions…" />;
  if (!isAuthenticated) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (!roles.includes(role)) return <AccessDenied />;
  return children;
}

/** Staff accounts work from the admin console, not the student token page. */
function StudentHome() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Navigate to="/admin" replace /> : <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/display" element={<Display />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <StudentHome />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole roles={['admin', 'super_admin']}>
            <Admin />
          </RequireRole>
        }
      />
      <Route
        path="/admin/services"
        element={
          <RequireRole roles={['super_admin']}>
            <ServiceAdmin />
          </RequireRole>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
