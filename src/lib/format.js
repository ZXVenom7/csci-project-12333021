export const FUEL_LABELS = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  hybrid: 'Hybrid',
  plug_in_hybrid: 'Plug-in Hybrid',
  electric: 'Electric',
};

export const TRANSMISSION_LABELS = {
  automatic: 'Automatic',
  manual: 'Manual',
  dual_clutch: 'Dual-Clutch',
  single_speed: 'Single-Speed',
};

export const CONDITION_LABELS = { new: 'New', used: 'Pre-Owned', certified: 'Certified Pre-Owned' };
export const STATUS_LABELS = { available: 'Available', reserved: 'Reserved', sold: 'Sold' };
export const INQUIRY_TYPE_LABELS = {
  general: 'General inquiry',
  appointment: 'Appointment',
  test_drive: 'Test drive',
  availability: 'Availability',
};

export function formatMoney(amount, currency) {
  if (amount === null || amount === undefined) return '';
  const { code = 'USD', locale = 'en-US' } = currency || {};
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${amount}`;
  }
}

export function formatNumber(value) {
  return value === null || value === undefined ? '' : Number(value).toLocaleString('en-US');
}

export function formatMileage(mileage, unit) {
  if (mileage === null || mileage === undefined) return '';
  return `${formatNumber(mileage)} ${unit === 'km' ? 'km' : 'miles'}`;
}

/** What the price pill shows for a vehicle, honouring its availability. */
export function priceLabel(vehicle, currency) {
  if (vehicle.status === 'sold') return 'Sold';
  if (vehicle.status === 'reserved' && vehicle.price === null) return 'Reserved';
  if (vehicle.price === null) return 'Price on request';
  return formatMoney(vehicle.price, currency);
}

export function transmissionLabel(vehicle) {
  return vehicle.transmission || TRANSMISSION_LABELS[vehicle.transmissionType] || '';
}

/** Label/value pairs for the quick spec panel on inventory cards. */
export function cardSpecs(vehicle, settings) {
  return [
    ['Mileage', formatMileage(vehicle.mileage, settings.distanceUnit)],
    ['Engine', vehicle.engine],
    ['Power', vehicle.horsepower !== null ? `${formatNumber(vehicle.horsepower)} hp` : ''],
    ['Trans', transmissionLabel(vehicle)],
    ['Drivetrain', vehicle.drivetrain],
    vehicle.status === 'available' ? ['Economy', vehicle.fuelEconomy] : ['Status', STATUS_LABELS[vehicle.status]],
  ].filter(([, value]) => value);
}

export function formatDate(value) {
  if (!value) return '';
  // Date-only strings are shown as calendar dates, without timezone shifting.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function whatsappLink(number, text) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
