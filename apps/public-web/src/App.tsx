import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { IncidentDataProvider } from '@/lib/hooks/useIncidentData';
import { AppShell } from '@/components/shell/AppShell';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminIncidents } from '@/pages/admin/AdminIncidents';
import { AdminIncidentProfile } from '@/pages/admin/AdminIncidentProfile';
import { AdminSubmissions } from '@/pages/admin/AdminSubmissions';
import { AdminSponsors } from '@/pages/admin/AdminSponsors';
import { AdminWidgets } from '@/pages/admin/AdminWidgets';
import { AdminFeeds } from '@/pages/admin/AdminFeeds';
import { AdminTicker } from '@/pages/admin/AdminTicker';
import { AdminReports } from '@/pages/admin/AdminReports';
import { AdminImport } from '@/pages/admin/AdminImport';
import { AdminUsers } from '@/pages/admin/AdminUsers';
import { AdminSubscriptions } from '@/pages/admin/AdminSubscriptions';
import { AdminSynthetic } from '@/pages/admin/AdminSynthetic';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { AdminSecurity } from '@/pages/admin/AdminSecurity';
import { AdminModPermissions } from '@/pages/admin/AdminModPermissions';
import { AdminBackupRestore } from '@/pages/admin/AdminBackupRestore';
import { LoginPage } from '@/pages/LoginPage';
import { IncidentPage } from '@/pages/IncidentPage';
import { AboutPage } from '@/pages/AboutPage';
import { MethodologyPage } from '@/pages/MethodologyPage';
import { ReportPage } from '@/pages/ReportPage';
import { SubscribePage } from '@/pages/SubscribePage';
import '@/styles/design-system.css';
import '@/styles/layout.css';
import '@/styles/pages.css';
import '@/styles/admin.css';
import '@/styles/widgets.css';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<IncidentDataProvider><AppShell /></IncidentDataProvider>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/incident/:id" element={<IncidentPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="incidents" element={<AdminIncidents />} />
          <Route path="incidents/:id" element={<AdminIncidentProfile />} />
          <Route path="submissions" element={<AdminSubmissions />} />
          <Route path="sponsors" element={<AdminSponsors />} />
          <Route path="widgets" element={<AdminWidgets />} />
          <Route path="feeds" element={<AdminFeeds />} />
          <Route path="ticker" element={<AdminTicker />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="import" element={<AdminImport />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="synthetic" element={<AdminSynthetic />} />
          <Route path="security" element={<AdminSecurity />} />
          <Route path="mod-permissions" element={<AdminModPermissions />} />
          <Route path="backup" element={<AdminBackupRestore />} />
          <Route path="images" element={<Navigate to="/admin/sponsors" replace />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
