import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from '../features/admin/AdminPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { PrivacyPage } from '../features/legal/PrivacyPage';
import { SupportPage } from '../features/legal/SupportPage';
import { ViewerPage } from '../features/viewer/ViewerPage';
import { AppLayout } from '../layouts/AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/" element={<Navigate to="/viewer" replace />} />
        <Route path="*" element={<Navigate to="/viewer" replace />} />
      </Route>
    </Routes>
  );
}
