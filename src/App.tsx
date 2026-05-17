import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ActiveWorkoutPage from '@/pages/ActiveWorkoutPage';
import HistoryPage from '@/pages/HistoryPage';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import TrendsPage from '@/pages/TrendsPage';
import RosterPage from '@/pages/RosterPage';

function PrivateRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="layout muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/history"
        element={
          <PrivateRoute>
            <HistoryPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/trends"
        element={
          <PrivateRoute>
            <TrendsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/roster"
        element={
          <PrivateRoute>
            <RosterPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/workout/:id"
        element={
          <PrivateRoute>
            <ActiveWorkoutPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
