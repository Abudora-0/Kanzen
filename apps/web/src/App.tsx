import { useEffect, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useAuth } from './lib/store';
import { AppShell } from './components/AppShell';
import { Landing } from './pages/Landing';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { WorkDetail } from './pages/WorkDetail';
import { Insights } from './pages/Insights';
import { Connections } from './pages/Connections';
import { Settings } from './pages/Settings';

function Protected({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <BootSplash />;
  if (!user) return <Navigate to="/enter" replace />;
  return children;
}

function BootSplash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="km-spinner h-8 w-8" />
    </div>
  );
}

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/enter" element={<AuthPage />} />
        <Route
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:id" element={<WorkDetail />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MotionConfig>
  );
}
