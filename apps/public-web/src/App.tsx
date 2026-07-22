import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MapPage } from './pages/MapPage';
import { IncidentPage } from './pages/IncidentPage';
import { ReportPage } from './pages/ReportPage';
import { AboutPage } from './pages/AboutPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { LoginPage } from './pages/LoginPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminIncidents } from './pages/admin/AdminIncidents';
import { AdminSubmissions } from './pages/admin/AdminSubmissions';
import { AdminSponsors } from './pages/admin/AdminSponsors';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminSynthetic } from './pages/admin/AdminSynthetic';
import { AdminWidgets } from './pages/admin/AdminWidgets';
import { AdminFeeds } from './pages/admin/AdminFeeds';
import { AdminTicker } from './pages/admin/AdminTicker';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminImport } from './pages/admin/AdminImport';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminSubscriptions } from './pages/admin/AdminSubscriptions';
import { SubscribePage } from './pages/SubscribePage';
import { useAppStore } from './store/app-store';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = useAppStore((s) => s.auth.isAuthenticated);
  if (!isAuth) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/incident/:id" element={<IncidentPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="incidents" element={<AdminIncidents />} />
          <Route path="submissions" element={<AdminSubmissions />} />
          <Route path="sponsors" element={<AdminSponsors />} />
          <Route path="synthetic" element={<AdminSynthetic />} />
          <Route path="widgets" element={<AdminWidgets />} />
          <Route path="feeds" element={<AdminFeeds />} />
          <Route path="ticker" element={<AdminTicker />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="import" element={<AdminImport />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
