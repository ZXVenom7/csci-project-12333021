import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useSite } from '../lib/SiteContext';
import './admin.css';
import { AuthContext } from './auth';
import Login from './Login';
import Overview from './Overview';
import VehicleList from './VehicleList';
import VehicleForm from './VehicleForm';
import Pricing from './Pricing';
import Taxonomy from './Taxonomy';
import Inquiries from './Inquiries';
import SiteContent from './SiteContent';
import Users from './Users';
import Account from './Account';




const NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/vehicles', label: 'Vehicles' },
  { to: '/admin/pricing', label: 'Pricing' },
  { to: '/admin/brands', label: 'Brands & Categories' },
  { to: '/admin/inquiries', label: 'Inquiries' },
  { to: '/admin/content', label: 'Site Content', owner: true },
  { to: '/admin/users', label: 'Administrators', owner: true },
  { to: '/admin/account', label: 'My Account' },
];

function AdminApp() {
  const { settings } = useSite();
  const { pathname } = useLocation();
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((result) => setUser(result.user)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    document.title = `Admin | ${settings.dealership.name}`;
  }, [settings.dealership.name]);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  // Any 401 from the API (expired session) drops back to the login screen.
  const guard = useCallback((failure) => {
    if (failure && failure.status === 401) setUser(null);
  }, []);

  const auth = useMemo(() => ({ user, setUser, logout, guard, isOwner: user && user.role === 'owner' }),
    [user, logout, guard]);

  if (user === undefined) return <div className="app-shell admin-shell" />;
  if (!user) return <Login onLogin={setUser} />;

  const ownerOnly = (element) => (auth.isOwner ? element : <Navigate to="/admin" replace />);

  return (
    <AuthContext.Provider value={auth}>
      <div className="app-shell admin-shell">
        <header className="app-header">
          <h1>{settings.dealership.name} <span className="admin-tag">Admin</span></h1>
          <div className="admin-header-actions">
            <span className="admin-user">{user.name} · {user.role}</span>
            <Link className="tab-btn" to="/" target="_blank" rel="noopener noreferrer">View site ↗</Link>
            <button type="button" className="tab-btn" onClick={logout}>Sign out</button>
            <button type="button" className="tab-btn admin-menu-btn" aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}>Menu</button>
          </div>
        </header>
        <div className="admin-body">
          <nav className={`admin-nav ${menuOpen ? 'open' : ''}`} aria-label="Admin">
            {NAV.filter((item) => !item.owner || auth.isOwner).map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <main className="admin-main">
            <Routes>
              <Route index element={<Overview />} />
              <Route path="vehicles" element={<VehicleList />} />
              <Route path="vehicles/new" element={<VehicleForm />} />
              <Route path="vehicles/:id" element={<VehicleForm />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="brands" element={<Taxonomy />} />
              <Route path="inquiries" element={<Inquiries />} />
              <Route path="content" element={ownerOnly(<SiteContent />)} />
              <Route path="users" element={ownerOnly(<Users />)} />
              <Route path="account" element={<Account />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}

export default AdminApp;
