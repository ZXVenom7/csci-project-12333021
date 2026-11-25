import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useSite } from '../lib/SiteContext';

const TABS = [
  { to: '/', label: 'Cars Available', end: false },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/book', label: 'Book an Appointment' },
];

function PublicLayout() {
  const { settings } = useSite();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // "Cars Available" stays highlighted on the inventory and on vehicle pages.
  const carsActive = pathname === '/' || pathname.startsWith('/vehicles');

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{settings.dealership.name}</h1>
        <nav aria-label="Primary">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `tab-btn ${(tab.to === '/' ? carsActive : isActive) ? 'active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default PublicLayout;
