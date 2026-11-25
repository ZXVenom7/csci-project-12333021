'use strict';

const { query } = require('../db/pool');

/**
 * Defaults mirror the copy that was hardcoded in the original site, so the
 * public pages look identical until the owner edits them in the dashboard.
 */
const DEFAULT_SETTINGS = {
  dealership: {
    name: 'Luxury Motor Sport',
    aboutHeading: 'About Luxury Motor Sport',
    aboutParagraphs: [
      'Welcome to Luxury Motor Sport. We specialize in offering premier performance, exotic, and ultra-luxury vehicles. Every vehicle in our showroom undergoes a thorough multi-point inspection to ensure complete safety and peak mechanical performance.',
      'Our dedicated team provides a transparent buying experience tailored to help you find your ideal luxury vehicle.',
    ],
  },
  contact: {
    addressLines: ['100 Luxury Way, Suite 500', 'Automotive District'],
    email: '12333021@liu.edu.lb',
    phone: '+961 799 788 799',
    // International number, digits only, used for wa.me links. Empty hides the buttons.
    whatsapp: '',
    hours: '',
  },
  currency: { code: 'USD', locale: 'en-US' },
  distanceUnit: 'mi',
  content: {
    inventoryHeading: 'Available Inventory',
    inventoryIntro:
      'Hover over any image for quick details. Click below a car to expand technical specifications.',
    featuredHeading: 'Featured Vehicles',
    bookingHeading: 'Book an Appointment',
    bookingIntro: 'Schedule a private viewing or test drive with an automotive specialist.',
  },
};

function merge(defaults, stored) {
  if (Array.isArray(defaults) || typeof defaults !== 'object' || defaults === null) {
    return stored === undefined ? defaults : stored;
  }
  const result = {};
  for (const key of Object.keys(defaults)) {
    result[key] = merge(defaults[key], stored && typeof stored === 'object' ? stored[key] : undefined);
  }
  return result;
}

async function getSettings() {
  const { rows } = await query("SELECT value FROM settings WHERE key = 'site'");
  return merge(DEFAULT_SETTINGS, rows[0] ? rows[0].value : undefined);
}

async function saveSettings(value) {
  await query(
    `INSERT INTO settings (key, value) VALUES ('site', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(value)],
  );
  return getSettings();
}

module.exports = { DEFAULT_SETTINGS, getSettings, saveSettings };
