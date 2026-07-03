import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminPlaceholder } from '../features/admin/AdminPlaceholder';
import { PrivacyPage } from '../features/legal/PrivacyPage';
import { ViewerPage } from '../features/viewer/ViewerPage';
import { AppLayout } from '../layouts/AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/admin/*" element={<AdminPlaceholder />} />
        <Route path="/" element={<Navigate to="/viewer" replace />} />
        <Route path="*" element={<Navigate to="/viewer" replace />} />
      </Route>
    </Routes>
  );
}
