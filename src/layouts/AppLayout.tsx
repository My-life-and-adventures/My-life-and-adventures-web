import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <main className="app-main">
      <Outlet />
    </main>
  );
}
