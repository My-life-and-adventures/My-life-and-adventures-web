import { Link, Outlet, useLocation } from 'react-router-dom';

export function AppLayout() {
  // The admin dashboard is tables and charts, not prose, so it opts out of the
  // 720px reading column the viewer and legal pages are built around.
  const wide = useLocation().pathname.startsWith('/admin');

  return (
    <div className="app-shell">
      <header className="brand-header">
        <Link to="/viewer" aria-label="My Life and Adventures home">
          <img
            className="brand-logo"
            src="/brand/logo.png"
            width={64}
            height={64}
            alt=""
          />
          <p className="brand-wordmark">My Life &amp; Adventures</p>
        </Link>
      </header>

      <main className={wide ? 'app-main app-main-wide' : 'app-main'}>
        <Outlet />
      </main>

      <footer className="brand-footer">
        <Link to="/privacy">Privacy Policy</Link>
        <span className="brand-footer-sep">·</span>
        <a href="mailto:support@mylife-and-adventures.com">Support</a>
        <br />
        © {new Date().getFullYear()} My Life and Adventures
      </footer>
    </div>
  );
}
