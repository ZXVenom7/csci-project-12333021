import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const vehicle = (overrides) => ({
  id: 'a1', slug: '2024-bmw-m4-competition', title: '2024 BMW M4 Competition',
  brand: { id: 1, name: 'BMW', slug: 'bmw' }, category: null, model: 'M4 Competition', year: 2024,
  price: 82200, previousPrice: null, discount: null, mileage: 1200, transmissionType: 'automatic',
  transmission: '8-Speed Auto', fuelType: 'petrol', engine: '3.0L Twin-Turbo', horsepower: 503,
  fuelEconomy: '16 / 23 MPG', drivetrain: 'RWD', condition: 'used', status: 'available', isFeatured: false,
  description: '', images: [], primaryImage: null,
  ...overrides,
});

const VEHICLES = [
  vehicle(),
  vehicle({ id: 'a2', slug: 'discounted', title: '2023 Porsche 911 Carrera', price: 100000, previousPrice: 125000, discount: { amount: 25000, percent: 20 } }),
  vehicle({ id: 'a3', slug: 'sold', title: '2024 Ferrari F8 Tributo', price: 280000, status: 'sold' }),
];

const SITE = {
  dealership: { name: 'Luxury Motor Sport', aboutHeading: 'About Luxury Motor Sport', aboutParagraphs: ['Welcome.'] },
  contact: { addressLines: ['100 Luxury Way'], email: 'sales@example.com', phone: '+1 555 0100', whatsapp: '', hours: '' },
  currency: { code: 'USD', locale: 'en-US' },
  distanceUnit: 'mi',
  content: { inventoryHeading: 'Available Inventory', inventoryIntro: 'Intro', featuredHeading: 'Featured Vehicles', bookingHeading: 'Book an Appointment', bookingIntro: '' },
};

beforeEach(() => {
  window.history.pushState({}, '', '/');
  window.scrollTo = jest.fn();
  global.fetch = jest.fn((url) => {
    let body = { error: { message: 'Not found.' } };
    if (url.startsWith('/api/site')) body = SITE;
    else if (url.startsWith('/api/vehicles/facets')) body = { brands: [], categories: [], fuelTypes: [], transmissions: [], bodyTypes: [], year: {}, price: {}, maxMileage: null };
    else if (url.includes('featured=true')) body = { items: [], total: 0, page: 1, pageSize: 6, totalPages: 1 };
    else if (url.startsWith('/api/vehicles')) body = { items: VEHICLES, total: VEHICLES.length, page: 1, pageSize: 24, totalPages: 1 };
    return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: () => Promise.resolve(body) });
  });
});

test('renders the dealership heading and the inventory returned by the API', async () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /luxury motor sport/i, level: 1 })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Available Inventory (3 Vehicles)' })).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(3);
});

test('shows prices, discounts and sold status from the database', async () => {
  render(<App />);
  const cards = await screen.findAllByRole('article');

  expect(within(cards[0]).getAllByText('$82,200').length).toBeGreaterThan(0);
  expect(within(cards[1]).getByText('$125,000')).toBeInTheDocument();
  expect(within(cards[1]).getByText('Save 20%')).toBeInTheDocument();
  expect(within(cards[2]).getAllByText('Sold').length).toBeGreaterThan(0);
  expect(within(cards[2]).queryByText('$280,000')).not.toBeInTheDocument();
});

test('toggles specifications without breaking the layout', async () => {
  render(<App />);

  await userEvent.click((await screen.findAllByRole('button', { name: /show specifications/i }))[0]);

  expect(screen.getAllByText(/mileage:/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/3\.0l twin-turbo/i).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: /hide specifications/i })).toBeInTheDocument();
});
