import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { SiteProvider } from './lib/SiteContext';
import PublicLayout from './components/PublicLayout';
import InventoryPage from './pages/InventoryPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import BookPage from './pages/BookPage';
import NotFoundPage from './pages/NotFoundPage';

// The dashboard is loaded on demand so visitors never download admin code.
const AdminApp = lazy(() => import('./admin/AdminApp'));

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SiteProvider>
        <Routes>
          <Route
            path="/admin/*"
            element={(
              <Suspense fallback={<div className="app-shell" />}>
                <AdminApp />
              </Suspense>
            )}
          />
          <Route element={<PublicLayout />}>
            <Route index element={<InventoryPage />} />
            <Route path="vehicles/:slug" element={<VehicleDetailPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="book" element={<BookPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </SiteProvider>
    </BrowserRouter>
  );
}

export default App;
