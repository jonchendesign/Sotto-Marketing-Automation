import { Link, Outlet, useLocation } from 'react-router-dom';

const NAV = [
  { path: '/', label: 'Campaigns' },
  { path: '/knowledge-base', label: 'Knowledge base' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/settings', label: 'Settings' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Sotto</div>
        <nav className="sidebar-nav">
          {NAV.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`sidebar-link ${location.pathname === path || (path === '/' ? false : location.pathname.startsWith(path)) ? 'active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
