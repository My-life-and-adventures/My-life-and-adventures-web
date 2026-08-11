import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from '../features/admin/AdminPage';
import { PrivacyPage } from '../features/legal/PrivacyPage';
import { ViewerPage } from '../features/viewer/ViewerPage';
import { AppLayout } from '../layouts/AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/" element={<Navigate to="/viewer" replace />} />
        <Route path="*" element={<Navigate to="/viewer" replace />} />
      </Route>
    </Routes>
  );
}
