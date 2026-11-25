import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

// Shown for the instant before the settings arrive (and if the API is down),
// so the header never renders empty. Real values always come from the database.
const FALLBACK = {
  dealership: { name: 'Luxury Motor Sport', aboutHeading: '', aboutParagraphs: [] },
  contact: { addressLines: [], email: '', phone: '', whatsapp: '', hours: '' },
  currency: { code: 'USD', locale: 'en-US' },
  distanceUnit: 'mi',
  content: { inventoryHeading: 'Available Inventory', inventoryIntro: '', featuredHeading: 'Featured Vehicles', bookingHeading: 'Book an Appointment', bookingIntro: '' },
};

const SiteContext = createContext({ settings: FALLBACK, loaded: false, reload: () => {} });

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => (
    api.get('/site')
      .then((data) => {
        setSettings(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true))
  ), []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => ({ settings, loaded, reload }), [settings, loaded, reload]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}

/** Sets the browser tab title for the current page. */
export function usePageTitle(title) {
  const { settings } = useSite();
  useEffect(() => {
    document.title = title ? `${title} | ${settings.dealership.name}` : settings.dealership.name;
  }, [title, settings.dealership.name]);
}
