import { lazy, Suspense, useEffect, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useAuth } from './lib/store';
import { useAccent } from './lib/accent';
import { useThemeInit } from './lib/theme';
import { useInterfaceSounds } from './lib/sound';
import { useCustomCursor } from './lib/cursor';
import { AppShell } from './components/AppShell';

// Route-level code splitting: each page ships as its own chunk so a visitor
// only downloads the pages they actually reach (the pre-auth Landing/Auth
// pair stays separate from the much heavier authenticated app pages).
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const ResetPassword = lazy(() =>
  import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })),
);
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })));
const WorkDetail = lazy(() =>
  import('./pages/WorkDetail').then((m) => ({ default: m.WorkDetail })),
);
const Insights = lazy(() => import('./pages/Insights').then((m) => ({ default: m.Insights })));
const Connections = lazy(() =>
  import('./pages/Connections').then((m) => ({ default: m.Connections })),
);
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

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
  useThemeInit();
  useAccent();
  useInterfaceSounds();
  useCustomCursor();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<BootSplash />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/enter" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
      </Suspense>
    </MotionConfig>
  );
}
