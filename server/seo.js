'use strict';

/**
 * Search/social support for the single-page app: sitemap.xml, robots.txt and
 * vehicle pages whose HTML is served with the correct <title>, description,
 * Open Graph tags (link previews in WhatsApp, iMessage, ...) and JSON-LD.
 */
const fs = require('fs/promises');
const path = require('path');
const db = require('./db/pool');
const { config } = require('./config');
const { getSettings } = require('./lib/settings');
const { VEHICLE_SELECT, serializeVehicle } = require('./lib/vehicles');

const INDEX_PATH = path.join(__dirname, '..', 'build', 'index.html');
let cachedTemplate;

function baseUrl(req) {
  return config.siteUrl || `${req.protocol}://${req.get('host')}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The built SPA shell: from disk, or (serverless) fetched from the static deployment. */
async function loadTemplate(req) {
  try {
    // Read on every request: the file is tiny and this picks up new builds.
    return await fs.readFile(INDEX_PATH, 'utf8');
  } catch {
    if (!cachedTemplate) {
      const response = await fetch(`${req.protocol}://${req.get('host')}/index.html`);
      if (!response.ok) throw new Error(`Could not load index.html (${response.status})`);
      cachedTemplate = await response.text();
    }
    return cachedTemplate;
  }
}

function absolute(url, origin) {
  return /^https?:\/\//.test(url) ? url : `${origin}${url}`;
}

function describe(vehicle, settings) {
  const parts = [
    vehicle.mileage != null ? `${vehicle.mileage.toLocaleString('en-US')} ${settings.distanceUnit}` : null,
    vehicle.engine,
    vehicle.horsepower != null ? `${vehicle.horsepower} hp` : null,
    vehicle.transmission,
    vehicle.drivetrain,
  ].filter(Boolean);
  const summary = vehicle.description ? vehicle.description.replace(/\s+/g, ' ').slice(0, 140) : '';
  return [`${vehicle.title} at ${settings.dealership.name}.`, parts.join(' · '), summary]
    .filter(Boolean).join(' ').slice(0, 300);
}

function vehicleJsonLd(vehicle, settings, url, origin) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: vehicle.title,
    url,
    brand: { '@type': 'Brand', name: vehicle.brand.name },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    image: vehicle.images.map((image) => absolute(image.url, origin)),
    description: vehicle.description || undefined,
    color: vehicle.exteriorColor || undefined,
    vehicleInteriorColor: vehicle.interiorColor || undefined,
    bodyType: vehicle.bodyType || undefined,
    driveWheelConfiguration: vehicle.drivetrain || undefined,
    vehicleTransmission: vehicle.transmission || undefined,
    vehicleIdentificationNumber: vehicle.vin || undefined,
    itemCondition: vehicle.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
  };
  if (vehicle.mileage != null) {
    data.mileageFromOdometer = {
      '@type': 'QuantitativeValue',
      value: vehicle.mileage,
      unitCode: settings.distanceUnit === 'km' ? 'KMT' : 'SMI',
    };
  }
  if (vehicle.price != null) {
    data.offers = {
      '@type': 'Offer',
      price: vehicle.price,
      priceCurrency: settings.currency.code,
      availability: vehicle.status === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      url,
    };
  }
  // "<" is escaped so the JSON can never close the surrounding <script> element.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** GET /vehicles/:slug: the SPA shell with vehicle-specific metadata. */
async function vehiclePage(req, res) {
  const template = await loadTemplate(req);
  const { rows } = await db.query(`${VEHICLE_SELECT} WHERE v.slug = $1 AND v.is_published`, [req.params.slug]);
  res.set('Cache-Control', 'no-cache');
  if (!rows[0]) {
    return res.status(404).type('html').send(template.replace('</head>', '<meta name="robots" content="noindex" /></head>'));
  }

  const [vehicle, settings] = [serializeVehicle(rows[0]), await getSettings()];
  const origin = baseUrl(req);
  const url = `${origin}/vehicles/${vehicle.slug}`;
  const title = `${vehicle.title} | ${settings.dealership.name}`;
  const description = describe(vehicle, settings);
  const image = vehicle.primaryImage ? absolute(vehicle.primaryImage.url, origin) : null;

  const tags = [
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escapeHtml(settings.dealership.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<script type="application/ld+json">${vehicleJsonLd(vehicle, settings, url, origin)}</script>`,
  ].join('');

  const html = template
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, () =>
      `<meta name="description" content="${escapeHtml(description)}"/>`)
    .replace('</head>', () => `${tags}</head>`);
  res.type('html').send(html);
}

async function sitemap(req, res) {
  const origin = baseUrl(req);
  const { rows } = await db.query(
    'SELECT slug, updated_at FROM vehicles WHERE is_published ORDER BY created_at DESC LIMIT 45000');
  const urls = [
    ...['/', '/about', '/contact', '/book'].map((route) => `<url><loc>${origin}${route}</loc></url>`),
    ...rows.map((row) =>
      `<url><loc>${origin}/vehicles/${escapeHtml(row.slug)}</loc><lastmod>${row.updated_at.toISOString().slice(0, 10)}</lastmod></url>`),
  ];
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
  );
}

function robots(req, res) {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
}

module.exports = { vehiclePage, sitemap, robots };
