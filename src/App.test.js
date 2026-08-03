import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('renders the dealership heading and inventory cards', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /luxury motor sport/i, level: 1 })).toBeInTheDocument();
  expect(screen.getByText(/available inventory/i)).toBeInTheDocument();
});

test('toggles specifications without breaking the layout', async () => {
  render(<App />);

  await userEvent.click(screen.getAllByRole('button', { name: /show specifications/i })[0]);

  expect(screen.getAllByText(/mileage:/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/3\.0l twin-turbo/i).length).toBeGreaterThan(0);
});
