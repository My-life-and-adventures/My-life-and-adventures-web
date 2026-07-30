import { Link, Outlet } from 'react-router-dom';

export function AppLayout() {
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

      <main className="app-main">
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
