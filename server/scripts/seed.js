'use strict';

/**
 * One-time import of the inventory that used to be hardcoded in src/App.js,
 * plus starter brands and categories. Safe to re-run: it does nothing once
 * the database contains vehicles.
 *
 * Only facts from the original listings (and the models' factory body style /
 * fuel type) are imported. Colours, VINs and descriptions were never on the
 * site, so they are left empty for the owner to fill in from the dashboard.
 */
const { assertConfig } = require('../config');
const { transaction, closePool } = require('../db/pool');
const { migrate } = require('../db/migrate');
const { slugify, uniqueSlug } = require('../lib/slug');

const UNSPLASH = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;
const UNSPLASH_THUMB = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
const WIKI = (file) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${file}`;

const CATEGORIES = ['Supercar', 'Sports Car', 'Grand Tourer', 'Luxury Sedan', 'Electric'];

// [year, brand, model, price, mileage, engine, hp, transmission, type, drivetrain, economy, fuel, body, category, image, status]
const VEHICLES = [
  [2024, 'BMW', 'M4 Competition', 82200, 1200, '3.0L Twin-Turbo', 503, '8-Speed Auto', 'automatic', 'RWD', '16 / 23 MPG', 'petrol', 'Coupe', 'Sports Car', 'photo-1617814076367-b759c7d7e738'],
  [2023, 'Porsche', '911 Carrera', 114400, 4500, '3.0L Twin-Turbo', 379, '8-Speed PDK', 'dual_clutch', 'RWD', '18 / 24 MPG', 'petrol', 'Coupe', 'Sports Car', 'photo-1614162692292-7ac56d7f7f1e'],
  [2025, 'Audi', 'RS e-tron GT', 147100, 250, 'Dual Electric Motor', 637, '2-Speed Auto', 'automatic', 'AWD', '83 MPGe', 'electric', 'Sedan', 'Electric', 'photo-1603584173870-7f23fdae1b7a'],
  [2024, 'Mercedes-AMG', 'C63 S', 83900, 800, '2.0L Turbo Hybrid', 671, '9-Speed Auto', 'automatic', 'AWD', '41 MPGe', 'plug_in_hybrid', 'Sedan', 'Luxury Sedan', 'photo-1618843479313-40f8afb4b4d8'],
  [2024, 'Lamborghini', 'Huracán EVO', 248295, 310, '5.2L V10', 631, '7-Speed Dual-Clutch', 'dual_clutch', 'AWD', '13 / 18 MPG', 'petrol', 'Coupe', 'Supercar', 'photo-1544829099-b9a0c07fad1a'],
  [2023, 'Aston Martin', 'DBS Superleggera', 330600, 1150, '5.2L Twin-Turbo V12', 715, '8-Speed Automatic', 'automatic', 'RWD', '14 / 22 MPG', 'petrol', 'Coupe', 'Grand Tourer', 'photo-1563720223185-11003d516935'],
  [2024, 'BMW', 'M5 Competition', 111900, 950, '4.4L Twin-Turbo V8', 617, '8-Speed Auto', 'automatic', 'AWD', '15 / 21 MPG', 'petrol', 'Sedan', 'Luxury Sedan', 'photo-1580273916550-e323be2ae537'],
  [2024, 'Tesla', 'Model S Plaid', 89990, 500, 'Tri-Motor EV', 1020, '1-Speed Auto', 'single_speed', 'AWD', '120 MPGe', 'electric', 'Sedan', 'Electric', 'photo-1617788138017-80ad40651399'],
  [2023, 'Porsche', '911 GT3 RS', 241300, 600, '4.0L Flat-6', 518, '7-Speed PDK', 'dual_clutch', 'RWD', '15 / 18 MPG', 'petrol', 'Coupe', 'Sports Car', 'photo-1503376780353-7e6692767b70'],
  [2024, 'Chevrolet', 'Corvette Z06', 112700, 1400, '5.5L Flat-Plane V8', 670, '8-Speed Dual-Clutch', 'dual_clutch', 'RWD', '12 / 19 MPG', 'petrol', 'Coupe', 'Sports Car', 'photo-1552519507-da3b142c6e3d'],
  // Listed on the original site as "Reserved / Sold Out" with no price.
  [2025, 'Bugatti', 'Tourbillon', null, 0, '8.3L V16 Hybrid', 1775, '8-Speed DCT', 'dual_clutch', 'AWD', null, 'hybrid', 'Coupe', 'Supercar', 'photo-1572982102138-86ca86d6b32e', 'reserved'],
  [2024, 'Audi', 'R8 V10 Performance', 209700, 2100, '5.2L Natural V10', 602, '7-Speed S-Tronic', 'dual_clutch', 'Quattro AWD', '14 / 23 MPG', 'petrol', 'Coupe', 'Supercar', WIKI('4/4c/2024_Audi_R8_V10_Performance.jpg/960px-2024_Audi_R8_V10_Performance.jpg')],
  [2023, 'Mercedes-AMG', 'GT Black Series', 325000, 400, '4.0L Twin-Turbo V8', 720, '7-Speed Auto', 'dual_clutch', 'RWD', '13 / 18 MPG', 'petrol', 'Coupe', 'Supercar', WIKI('5/5a/Mercedes-AMG_GT_Black_Series_IMG_0324.jpg/960px-Mercedes-AMG_GT_Black_Series_IMG_0324.jpg')],
  [2024, 'Ferrari', 'F8 Tributo', 280000, 1000, '3.9L Twin-Turbo V8', 710, '7-Speed F1 Dual-Clutch', 'dual_clutch', 'RWD', '15 / 19 MPG', 'petrol', 'Coupe', 'Supercar', 'photo-1583121274602-3e2820c69888'],
  // Listed on the original site as "Not Available" with no price.
  [2025, 'Koenigsegg', 'Jesko Absolut', null, 50, '5.0L Twin-Turbo V8', 1600, '9-Speed LST', 'automatic', 'RWD', null, 'petrol', 'Coupe', 'Supercar', 'photo-1724091663890-d84c2abfb28b', 'reserved'],
  [2023, 'McLaren', '720S', 310500, 1800, '4.0L Twin-Turbo V8', 710, '7-Speed SSG', 'dual_clutch', 'RWD', '15 / 22 MPG', 'petrol', 'Coupe', 'Supercar', 'photo-1621135802920-133df287f89c'],
  [2024, 'Rolls-Royce', 'Ghost', 348000, 300, '6.75L Twin-Turbo V12', 563, '8-Speed Auto', 'automatic', 'AWD', '12 / 19 MPG', 'petrol', 'Sedan', 'Luxury Sedan', 'photo-1562911791-c7a97b729ec5'],
  [2024, 'Bentley', 'Continental GT', 238000, 1100, '4.0L Twin-Turbo V8', 542, '8-Speed Dual-Clutch', 'dual_clutch', 'AWD', '16 / 26 MPG', 'petrol', 'Coupe', 'Grand Tourer', 'photo-1502877338535-766e1452684a'],
  [2024, 'Nissan', 'GT-R Nismo', 221090, 700, '3.8L Twin-Turbo V6', 600, '6-Speed Dual-Clutch', 'dual_clutch', 'AWD', '16 / 22 MPG', 'petrol', 'Coupe', 'Sports Car', 'photo-1542282088-72c9c27ed0cd'],
  [2024, 'Maserati', 'MC20', 212000, 850, '3.0L Twin-Turbo V6', 621, '8-Speed Dual-Clutch', 'dual_clutch', 'RWD', '15 / 25 MPG', 'petrol', 'Coupe', 'Supercar', 'photo-1549399542-7e3f8b79c341'],
  [2024, 'Lucid', 'Air Sapphire', 249000, 400, 'Tri-Motor EV', 1234, '1-Speed Automatic', 'single_speed', 'AWD', '105 MPGe', 'electric', 'Sedan', 'Electric', WIKI('c/c8/Lucid_Air_Sapphire_%2878590%29.jpg/960px-Lucid_Air_Sapphire_%2878590%29.jpg')],
  [2024, 'Porsche', 'Taycan Turbo S', 194900, 900, 'Dual Electric Motor', 750, '2-Speed Auto', 'automatic', 'AWD', '75 MPGe', 'electric', 'Sedan', 'Electric', 'photo-1634317558729-c410a4133faa'],
];

async function seed({ log = console.log } = {}) {
  await migrate({ log });
  return transaction(async (client) => {
    const existing = await client.query('SELECT count(*)::int AS count FROM vehicles');
    if (existing.rows[0].count) {
      log(`Skipped: the database already has ${existing.rows[0].count} vehicle(s).`);
      return 0;
    }

    const ids = { brands: {}, categories: {} };
    const ensure = async (table, name) => {
      if (ids[table][name]) return ids[table][name];
      const found = await client.query(`SELECT id FROM ${table} WHERE lower(name) = lower($1)`, [name]);
      const row = found.rows[0] || (await client.query(
        `INSERT INTO ${table} (name, slug) VALUES ($1, $2) RETURNING id`, [name, slugify(name)])).rows[0];
      ids[table][name] = row.id;
      return row.id;
    };
    for (const name of CATEGORIES) await ensure('categories', name);

    // The first listing gets the newest timestamp so "newest first" keeps the original order.
    const start = Date.now();
    for (const [index, entry] of VEHICLES.entries()) {
      const [year, brand, model, price, mileage, engine, horsepower, transmission, transmissionType,
        drivetrain, fuelEconomy, fuelType, bodyType, category, image, status = 'available'] = entry;
      const slug = await uniqueSlug(client, 'vehicles', `${year} ${brand} ${model}`);
      const { rows } = await client.query(
        `INSERT INTO vehicles (slug, brand_id, category_id, model, year, price, mileage, engine, horsepower,
           transmission, transmission_type, drivetrain, fuel_economy, fuel_type, body_type, condition,
           status, is_published, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,$18) RETURNING id`,
        [slug, await ensure('brands', brand), await ensure('categories', category), model, year, price,
          mileage, engine, horsepower, transmission, transmissionType, drivetrain, fuelEconomy, fuelType,
          bodyType, mileage === 0 ? 'new' : 'used', status, new Date(start - index * 60000)],
      );
      const external = image.startsWith('https://');
      await client.query(
        `INSERT INTO vehicle_images (vehicle_id, url, thumb_url, alt, is_primary)
         VALUES ($1, $2, $3, $4, true)`,
        [rows[0].id, external ? image : UNSPLASH(image), external ? image : UNSPLASH_THUMB(image),
          `${year} ${brand} ${model}`],
      );
    }
    log(`Imported ${VEHICLES.length} vehicles, ${Object.keys(ids.brands).length} brands and ${CATEGORIES.length} categories.`);
    return VEHICLES.length;
  });
}

if (require.main === module) {
  (async () => {
    try {
      assertConfig();
      await seed();
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    } finally {
      await closePool();
    }
  })();
}

module.exports = { seed };
