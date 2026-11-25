'use strict';

/**
 * End-to-end API tests against a real PostgreSQL database.
 *
 *   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/dealership_test npm run test:api
 *
 * The target database is WIPED on every run, so the runner refuses any
 * database whose name does not end in "_test".
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');

const TEST_DB = process.env.TEST_DATABASE_URL;
if (!TEST_DB || !/_test(\?|$)/.test(TEST_DB)) {
  throw new Error('Set TEST_DATABASE_URL to a database whose name ends in "_test" (it is wiped on every run).');
}
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-uploads-'));
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DB,
  DATABASE_SSL: 'false',
  JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
  STORAGE_DRIVER: 'local',
  UPLOAD_DIR: uploadDir,
  SITE_URL: '',
  CORS_ORIGINS: '',
});

const sharp = require('sharp');
const db = require('../db/pool');
const { migrate } = require('../db/migrate');
const { seed } = require('../scripts/seed');
const { hashPassword } = require('../lib/auth');
const { createApp } = require('../app');

const OWNER = { email: 'owner@test.local', password: 'owner-password-123' };
const EDITOR = { email: 'editor@test.local', password: 'editor-password-123' };
let server;
let base;

/** Minimal HTTP client that keeps its own session cookie, like a browser tab. */
function client() {
  let cookie = '';
  async function call(method, url, body, headers = {}) {
    const options = { method, headers: { 'X-Requested-With': 'XMLHttpRequest', ...headers }, redirect: 'manual' };
    if (cookie) options.headers.Cookie = cookie;
    if (body instanceof FormData) options.body = body;
    else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(base + url, options);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = response.headers.get('content-type') || '';
    const data = type.includes('json') ? await response.json() : await response.text();
    return { status: response.status, data, headers: response.headers };
  }
  return {
    get: (url) => call('GET', url),
    post: (url, body, headers) => call('POST', url, body, headers),
    put: (url, body) => call('PUT', url, body),
    patch: (url, body) => call('PATCH', url, body),
    delete: (url) => call('DELETE', url),
    login: (credentials) => call('POST', '/api/auth/login', credentials),
  };
}

const anon = client();
const owner = client();
const editor = client();

function jpeg(width = 2400, height = 1600) {
  return sharp({ create: { width, height, channels: 3, background: { r: 180, g: 140, b: 40 } } }).jpeg().toBuffer();
}

function uploadForm(buffer, name = 'car.jpg', type = 'image/jpeg') {
  const form = new FormData();
  form.append('images', new Blob([buffer], { type }), name);
  return form;
}

const fileFor = (url) => path.join(uploadDir, url.replace('/uploads/', ''));

before(async () => {
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await seed({ log: () => {} });
  await db.query('INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4)',
    [OWNER.email, 'Test Owner', 'owner', await hashPassword(OWNER.password)]);
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.closePool();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

test('migrations are idempotent and the legacy inventory was imported', async () => {
  assert.equal(await migrate({ log: () => {} }), 0);
  assert.equal(await seed({ log: () => {} }), 0, 'seeding twice must not duplicate vehicles');
  const { data } = await anon.get('/api/vehicles?pageSize=60');
  assert.equal(data.total, 22);
  assert.equal(data.items.length, 22);
  assert.ok(data.items.every((vehicle) => vehicle.primaryImage), 'every imported vehicle has its photo');
  assert.equal(data.items.at(-1).status, 'reserved', 'unavailable vehicles sort last');
});

test('admin routes reject anonymous, forged and malformed requests', async () => {
  for (const [method, url] of [['get', '/api/admin/overview'], ['get', '/api/admin/vehicles'],
    ['get', '/api/admin/users'], ['get', '/api/admin/inquiries'], ['get', '/api/auth/me']]) {
    assert.equal((await anon[method](url)).status, 401, `${url} must require sign-in`);
  }
  assert.equal((await anon.post('/api/admin/vehicles', { model: 'X' })).status, 401);
  assert.equal((await anon.delete('/api/admin/vehicles/00000000-0000-0000-0000-000000000000')).status, 401);

  const forged = await fetch(`${base}/api/admin/overview`, { headers: { Cookie: 'lms_session=not.a.token' } });
  assert.equal(forged.status, 401);
  assert.equal((await anon.get('/api/nope')).status, 404);
});

test('login: wrong credentials fail identically, correct ones start a session', async () => {
  const wrongPassword = await anon.login({ email: OWNER.email, password: 'wrong-password-1' });
  const unknownUser = await anon.login({ email: 'nobody@test.local', password: 'wrong-password-1' });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownUser.status, 401);
  assert.equal(wrongPassword.data.error.message, unknownUser.data.error.message);

  const ok = await owner.login(OWNER);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, 'owner');
  assert.equal(ok.data.user.password_hash, undefined);
  assert.match(ok.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(ok.headers.get('set-cookie'), /SameSite=Strict/i);
  assert.equal((await owner.get('/api/auth/me')).data.user.email, OWNER.email);

  const stored = await db.query('SELECT password_hash FROM users WHERE email = $1', [OWNER.email]);
  assert.match(stored.rows[0].password_hash, /^\$2[aby]\$12\$/, 'passwords are stored as bcrypt hashes');
});

test('CSRF: cookie-authenticated mutations need the custom header and a same-site origin', async () => {
  const noHeader = await owner.post('/api/admin/brands', { name: 'Csrf' }, { 'X-Requested-With': '' });
  assert.equal(noHeader.status, 403);
  const crossOrigin = await owner.post('/api/admin/brands', { name: 'Csrf' }, { Origin: 'https://evil.example' });
  assert.equal(crossOrigin.status, 403);
  const { rows } = await db.query("SELECT 1 FROM brands WHERE name = 'Csrf'");
  assert.equal(rows.length, 0);
});

let brandId;
let categoryId;
let vehicle;

test('brands and categories: create, rename, duplicate and delete rules', async () => {
  const created = await owner.post('/api/admin/brands', { name: '  Pagani ' });
  assert.equal(created.status, 201);
  assert.equal(created.data.name, 'Pagani');
  assert.equal(created.data.slug, 'pagani');
  brandId = created.data.id;

  assert.equal((await owner.post('/api/admin/brands', { name: 'pagani' })).status, 409);
  assert.equal((await owner.post('/api/admin/brands', { name: '' })).status, 400);
  const renamed = await owner.put(`/api/admin/brands/${brandId}`, { name: 'Pagani Automobili' });
  assert.equal(renamed.data.slug, 'pagani-automobili');

  const category = await owner.post('/api/admin/categories', { name: 'Hypercar' });
  assert.equal(category.status, 201);
  categoryId = category.data.id;
  assert.ok((await anon.get('/api/brands')).data.some((brand) => brand.name === 'Pagani Automobili'));
});

test('vehicle creation validates input and starts as an unpublished draft', async () => {
  const invalid = await owner.post('/api/admin/vehicles', { brandId, model: '', year: 1500, price: -5, vin: 'short' });
  assert.equal(invalid.status, 400);
  assert.deepEqual(Object.keys(invalid.data.error.fields).sort(), ['model', 'price', 'vin', 'year']);

  const badDiscount = await owner.post('/api/admin/vehicles', { brandId, model: 'Utopia', year: 2024, price: 100, previousPrice: 90 });
  assert.equal(badDiscount.status, 400);
  assert.ok(badDiscount.data.error.fields.previousPrice);
  assert.equal((await owner.post('/api/admin/vehicles', { brandId: 999999, model: 'Utopia', year: 2024 })).status, 400);

  const created = await owner.post('/api/admin/vehicles', {
    brandId, categoryId, model: 'Utopia', year: '2024', price: '2190000', mileage: '120',
    transmissionType: 'manual', transmission: '7-Speed Manual', fuelType: 'petrol', engine: '6.0L Twin-Turbo V12',
    horsepower: 852, exteriorColor: 'Grigio', interiorColor: 'Tan', bodyType: 'Coupe', drivetrain: 'RWD',
    vin: 'za9ut0p1a12345678', condition: 'new', description: 'Line one.\n\n<script>alert(1)</script>',
  });
  assert.equal(created.status, 201);
  vehicle = created.data;
  assert.equal(vehicle.title, '2024 Pagani Automobili Utopia');
  assert.equal(vehicle.slug, '2024-pagani-automobili-utopia');
  assert.equal(vehicle.price, 2190000);
  assert.equal(vehicle.vin, 'ZA9UT0P1A12345678');
  assert.equal(vehicle.isPublished, false);
  assert.equal(vehicle.status, 'available');

  const duplicateVin = await owner.post('/api/admin/vehicles', { brandId, model: 'Huayra', year: 2023, vin: 'ZA9UT0P1A12345678' });
  assert.equal(duplicateVin.status, 409);

  assert.equal((await anon.get(`/api/vehicles/${vehicle.slug}`)).status, 404, 'drafts are hidden from the public');
  assert.equal((await anon.get('/api/vehicles?pageSize=60')).data.total, 22);
});

test('publishing makes the vehicle appear on the public site', async () => {
  const published = await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { isPublished: true });
  assert.equal(published.data.isPublished, true);
  const detail = await anon.get(`/api/vehicles/${vehicle.slug}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.isPublished, undefined, 'admin-only fields are not exposed publicly');
  assert.equal(detail.data.description, 'Line one.\n\n<script>alert(1)</script>', 'text is stored verbatim and escaped at render time');
  assert.equal((await anon.get('/api/vehicles?pageSize=60')).data.total, 23);
});

test('price changes and discounts flow through to the public API', async () => {
  const cheaper = await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { price: 1971000, previousPrice: 2190000 });
  assert.equal(cheaper.status, 200);
  let detail = (await anon.get(`/api/vehicles/${vehicle.slug}`)).data;
  assert.equal(detail.price, 1971000);
  assert.equal(detail.previousPrice, 2190000);
  assert.deepEqual(detail.discount, { amount: 219000, percent: 10 });

  // Raising the price above the previous price drops the now-meaningless discount.
  await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { price: 2300000 });
  detail = (await anon.get(`/api/vehicles/${vehicle.slug}`)).data;
  assert.equal(detail.price, 2300000);
  assert.equal(detail.discount, null);
  assert.equal(detail.previousPrice, null);

  const onRequest = await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { price: '' });
  assert.equal(onRequest.data.price, null);
  await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { price: 2190000 });
});

test('full edit (PUT) updates every field and keeps the URL stable', async () => {
  const updated = await owner.put(`/api/admin/vehicles/${vehicle.id}`, {
    brandId, categoryId: '', model: 'Utopia Roadster', year: 2025, price: 2500000, previousPrice: '',
    mileage: 300, transmissionType: 'automatic', transmission: '', fuelType: 'petrol', engine: '6.0L V12',
    horsepower: 864, fuelEconomy: '', exteriorColor: 'Blue', interiorColor: '', bodyType: 'Convertible',
    drivetrain: 'RWD', vin: '', condition: 'used', status: 'available', isPublished: true, isFeatured: true,
    description: 'Updated.',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.title, '2025 Pagani Automobili Utopia Roadster');
  assert.equal(updated.data.slug, vehicle.slug);
  assert.equal(updated.data.category, null);
  assert.equal(updated.data.vin, null);
  assert.equal(updated.data.bodyType, 'Convertible');
  vehicle = updated.data;

  const featured = (await anon.get('/api/vehicles?featured=true')).data;
  assert.deepEqual(featured.items.map((item) => item.id), [vehicle.id]);
});

test('availability: reserved and sold show publicly; sold vehicles cannot be booked', async () => {
  await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { status: 'reserved' });
  assert.equal((await anon.get(`/api/vehicles/${vehicle.slug}`)).data.status, 'reserved');
  await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { status: 'sold' });
  assert.equal((await anon.get(`/api/vehicles/${vehicle.slug}`)).data.status, 'sold');
  assert.equal((await anon.get('/api/vehicles?status=sold')).data.total, 1);
  assert.equal((await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { status: 'gone' })).status, 400);

  const booking = await anon.post('/api/inquiries', {
    type: 'test_drive', vehicleId: vehicle.id, name: 'Sam Buyer', email: 'sam@example.com', preferredDate: '2099-01-01',
  });
  assert.equal(booking.status, 400);
  await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { status: 'available' });
});

test('search, filters, sorting and pagination query the real inventory', async () => {
  const count = async (query) => (await anon.get(`/api/vehicles?pageSize=60&${query}`)).data.total;
  assert.equal(await count('brand=porsche'), 3);
  assert.equal(await count('q=porsche+911'), 2);
  assert.equal(await count('q=PAGANI'), 1);
  assert.equal(await count('model=taycan'), 1);
  assert.equal(await count('fuelType=electric'), 4);
  assert.equal(await count('transmission=manual'), 0, 'the Pagani is now automatic');
  assert.equal(await count('transmission=single_speed'), 2);
  assert.equal(await count('category=electric'), 4);
  assert.equal(await count('minYear=2025'), 4);
  assert.equal(await count('maxYear=2023'), 5);
  assert.equal(await count('maxPrice=90000'), 3);
  assert.equal(await count('minPrice=300000&maxPrice=350000'), 4);
  assert.equal(await count('maxMileage=300'), 5);
  assert.equal(await count('brand=bmw&minPrice=100000'), 1);
  assert.equal(await count("q=%25'%3B DROP TABLE vehicles%3B--"), 0, 'hostile input is treated as text');
  assert.equal(await count('minYear=abc&fuelType=plutonium'), 23, 'malformed filters are ignored');

  const byPrice = (await anon.get('/api/vehicles?sort=price_asc&pageSize=3')).data;
  assert.deepEqual(byPrice.items.map((item) => item.price), [82200, 83900, 89990]);

  const pageOne = (await anon.get('/api/vehicles?sort=price_asc&pageSize=10&page=1')).data;
  const pageThree = (await anon.get('/api/vehicles?sort=price_asc&pageSize=10&page=3')).data;
  assert.equal(pageOne.totalPages, 3);
  assert.equal(pageOne.items.length, 10);
  assert.equal(pageThree.items.length, 3);
  assert.equal((await anon.get('/api/vehicles?pageSize=10&page=99')).data.page, 3, 'out-of-range pages clamp');
  assert.equal((await anon.get('/api/vehicles?pageSize=5000')).data.pageSize, 60, 'page size is capped');

  const facets = (await anon.get('/api/vehicles/facets')).data;
  assert.equal(facets.brands.find((brand) => brand.slug === 'porsche').count, 3);
  assert.equal(facets.year.min, 2023);
  assert.equal(facets.price.max, 2500000);
});

test('images: upload, optimise, primary selection, ordering and deletion', async () => {
  const first = await owner.post(`/api/admin/vehicles/${vehicle.id}/images`, uploadForm(await jpeg()));
  assert.equal(first.status, 201);
  const [imageA] = first.data.images;
  assert.equal(imageA.isPrimary, true, 'the first photo becomes the primary one');
  assert.equal(imageA.width, 1920, 'large photos are resized');
  assert.match(imageA.url, /^\/uploads\/vehicles\/.+\.webp$/);

  const served = await fetch(base + imageA.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/webp');
  assert.match(served.headers.get('cache-control'), /immutable/);
  const thumb = await sharp(Buffer.from(await (await fetch(base + imageA.thumbUrl)).arrayBuffer())).metadata();
  assert.equal(thumb.width, 640);

  const png = await sharp({ create: { width: 800, height: 600, channels: 4, background: '#224466' } }).png().toBuffer();
  const form = new FormData();
  form.append('images', new Blob([png], { type: 'image/png' }), 'b.png');
  form.append('images', new Blob([await jpeg(1000, 700)], { type: 'image/jpeg' }), 'c.jpg');
  const more = await owner.post(`/api/admin/vehicles/${vehicle.id}/images`, form);
  assert.equal(more.data.images.length, 3);
  const [, imageB, imageC] = more.data.images;
  assert.equal(imageB.width, 800, 'small photos are not enlarged');

  const primary = await owner.patch(`/api/admin/images/${imageC.id}`, { isPrimary: true });
  assert.equal(primary.data.primaryImage.id, imageC.id);
  assert.equal(primary.data.images.filter((image) => image.isPrimary).length, 1);
  assert.equal((await anon.get(`/api/vehicles/${vehicle.slug}`)).data.primaryImage.id, imageC.id);

  const reordered = await owner.put(`/api/admin/vehicles/${vehicle.id}/images/order`, { imageIds: [imageB.id, imageC.id, imageA.id] });
  assert.deepEqual(reordered.data.images.map((image) => image.id), [imageC.id, imageB.id, imageA.id], 'primary first, then saved order');
  assert.equal((await owner.put(`/api/admin/vehicles/${vehicle.id}/images/order`, { imageIds: [imageB.id] })).status, 400);

  const external = await owner.post(`/api/admin/vehicles/${vehicle.id}/images/url`, { url: 'https://example.com/car.jpg' });
  assert.equal(external.data.images.length, 4);
  // eslint-disable-next-line no-script-url
  assert.equal((await owner.post(`/api/admin/vehicles/${vehicle.id}/images/url`, { url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await owner.post(`/api/admin/vehicles/${vehicle.id}/images/url`, { url: 'http://example.com/a.jpg' })).status, 400);

  assert.ok(fs.existsSync(fileFor(imageC.url)));
  const afterDelete = await owner.delete(`/api/admin/images/${imageC.id}`);
  assert.equal(afterDelete.data.images.length, 3);
  assert.equal(afterDelete.data.primaryImage.id, imageB.id, 'deleting the primary promotes the next photo');
  assert.ok(!fs.existsSync(fileFor(imageC.url)), 'the file is removed from storage');
  assert.ok(!fs.existsSync(fileFor(imageC.thumbUrl)));
});

test('images: uploads are validated by content, size and authentication', async () => {
  const before = (await owner.get(`/api/admin/vehicles/${vehicle.id}`)).data.images.length;

  const html = Buffer.from('<html><script>alert(1)</script></html>');
  assert.equal((await owner.post(`/api/admin/vehicles/${vehicle.id}/images`, uploadForm(html, 'evil.jpg', 'image/jpeg'))).status, 400,
    'a non-image with an image name and MIME type is rejected');
  assert.equal((await owner.post(`/api/admin/vehicles/${vehicle.id}/images`, uploadForm(html, 'evil.html', 'text/html'))).status, 400);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal((await owner.post(`/api/admin/vehicles/${vehicle.id}/images`, uploadForm(svg, 'x.svg', 'image/svg+xml'))).status, 400);
  const truncated = (await jpeg(400, 300)).subarray(0, 200);
  assert.equal((await owner.post(`/api/admin/vehicles/${vehicle.id}/images`, uploadForm(truncated))).status, 400);

  const huge = Buffer.concat([await jpeg(100, 100), Buffer.alloc(9 * 1024 * 1024)]);
  const tooBig = await owner.post(`/api/admin/vehicles/${vehicle.id}/images`, uploadForm(huge));
  assert.equal(tooBig.status, 400);
  assert.match(tooBig.data.error.message, /8 MB/);

  assert.equal((await anon.post(`/api/admin/vehicles/${vehicle.id}/images`, uploadForm(await jpeg(100, 100)))).status, 401);
  assert.equal((await owner.post('/api/admin/vehicles/00000000-0000-0000-0000-000000000000/images', uploadForm(await jpeg(100, 100)))).status, 404);
  // Path traversal out of the uploads directory must never reach project files.
  for (const attempt of ['/uploads/..%2f..%2fserver%2fconfig.js', '/uploads/..%2f..%2f.env', '/uploads/.env', '/uploads/%2e%2e%2fpackage.json']) {
    const response = await fetch(base + attempt);
    const body = await response.text();
    assert.ok([400, 403, 404].includes(response.status), `${attempt} must not be served (got ${response.status})`);
    assert.ok(!/JWT_SECRET|DATABASE_URL|"dependencies"/.test(body));
  }

  assert.equal((await owner.get(`/api/admin/vehicles/${vehicle.id}`)).data.images.length, before);
});

test('inquiries: public submission, validation, honeypot and admin management', async () => {
  const invalid = await anon.post('/api/inquiries', { type: 'appointment', name: 'A', email: 'nope' });
  assert.equal(invalid.status, 400);
  assert.deepEqual(Object.keys(invalid.data.error.fields).sort(), ['email', 'name']);
  const missingDate = await anon.post('/api/inquiries', { type: 'appointment', name: 'Sam Buyer', email: 'sam@example.com' });
  assert.ok(missingDate.data.error.fields.preferredDate);

  const sent = await anon.post('/api/inquiries', {
    type: 'test_drive', vehicleId: vehicle.id, name: 'Sam Buyer', email: 'Sam@Example.com', phone: '+961 70 123 456',
    message: 'Is Saturday possible?', preferredDate: '2099-03-14',
  });
  assert.equal(sent.status, 201);

  const bot = await anon.post('/api/inquiries', { type: 'general', name: 'Spam Bot', email: 'bot@example.com', message: 'x', website: 'http://spam' });
  assert.equal(bot.status, 201, 'bots get a normal-looking response');

  assert.equal((await anon.get('/api/admin/inquiries')).status, 401);
  const list = (await owner.get('/api/admin/inquiries')).data;
  assert.equal(list.total, 1, 'the honeypot submission was not stored');
  const [inquiry] = list.items;
  assert.equal(inquiry.email, 'sam@example.com');
  assert.equal(inquiry.vehicleTitle, vehicle.title);
  assert.equal(inquiry.preferredDate, '2099-03-14');
  assert.equal(inquiry.status, 'new');
  assert.equal((await owner.get('/api/admin/overview')).data.newInquiries, 1);

  const handled = await owner.patch(`/api/admin/inquiries/${inquiry.id}`, { status: 'closed', adminNotes: 'Called back.' });
  assert.equal(handled.data.status, 'closed');
  assert.equal((await owner.get('/api/admin/inquiries?status=new')).data.total, 0);

  // 5 submissions per 10 minutes per visitor: the two real attempts above plus these.
  let limited;
  for (let attempt = 0; attempt < 6 && !limited; attempt += 1) {
    const response = await anon.post('/api/inquiries', { type: 'general', name: 'Sam Buyer', email: 'sam@example.com', message: `Hello ${attempt}` });
    if (response.status === 429) limited = response;
  }
  assert.ok(limited, 'repeated submissions are rate limited');
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  await db.query('DELETE FROM rate_limits');
});

test('overview reports live inventory statistics', async () => {
  const { data } = await owner.get('/api/admin/overview');
  assert.equal(data.totalVehicles, 23);
  assert.equal(data.available, 21);
  assert.equal(data.reserved, 2);
  assert.equal(data.sold, 0);
  const expected = await db.query("SELECT sum(price) AS value FROM vehicles WHERE status <> 'sold'");
  assert.equal(data.inventoryValue, expected.rows[0].value);
  assert.equal(data.recentVehicles[0].id, vehicle.id, 'most recently added first');

  await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { status: 'sold' });
  const afterSale = (await owner.get('/api/admin/overview')).data;
  assert.equal(afterSale.sold, 1);
  assert.equal(afterSale.inventoryValue, data.inventoryValue - 2500000);
  await owner.patch(`/api/admin/vehicles/${vehicle.id}`, { status: 'available' });
});

test('site settings: owner edits are validated and shown on the public site', async () => {
  const current = (await owner.get('/api/admin/settings')).data;
  assert.equal(current.dealership.name, 'Luxury Motor Sport');

  const bad = await owner.put('/api/admin/settings', { ...current, currency: { code: 'ZZZZ', locale: 'en-US' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.error.fields['currency.code']);

  const saved = await owner.put('/api/admin/settings', {
    ...current,
    dealership: { ...current.dealership, name: 'Prestige Motors' },
    contact: { ...current.contact, whatsapp: '+961 70 123 456', hours: 'Mon-Sat 9-6' },
    currency: { code: 'eur', locale: 'de-DE' },
    distanceUnit: 'km',
  });
  assert.equal(saved.status, 200);
  const site = (await anon.get('/api/site')).data;
  assert.equal(site.dealership.name, 'Prestige Motors');
  assert.equal(site.contact.whatsapp, '96170123456');
  assert.deepEqual(site.currency, { code: 'EUR', locale: 'de-DE' });
  assert.equal(site.distanceUnit, 'km');
  await owner.put('/api/admin/settings', current);
});

test('roles: editors manage inventory but not settings or accounts', async () => {
  const weak = await owner.post('/api/admin/users', { email: EDITOR.email, name: 'Ed Itor', role: 'editor', password: 'short' });
  assert.equal(weak.status, 400);
  const created = await owner.post('/api/admin/users', { ...EDITOR, name: 'Ed Itor', role: 'editor' });
  assert.equal(created.status, 201);
  assert.equal((await owner.post('/api/admin/users', { ...EDITOR, email: 'EDITOR@test.local', name: 'Dup', role: 'editor' })).status, 409);

  assert.equal((await editor.login(EDITOR)).status, 200);
  assert.equal((await editor.patch(`/api/admin/vehicles/${vehicle.id}`, { isFeatured: false })).status, 200);
  assert.equal((await editor.get('/api/admin/settings')).status, 200);
  assert.equal((await editor.put('/api/admin/settings', {})).status, 403);
  assert.equal((await editor.get('/api/admin/users')).status, 403);
  assert.equal((await editor.post('/api/admin/users', { email: 'x@test.local', name: 'X', role: 'owner', password: 'long-enough-pass' })).status, 403);
  assert.equal((await editor.patch(`/api/admin/users/${created.data.id}`, { role: 'owner' })).status, 403);

  const me = (await owner.get('/api/auth/me')).data.user;
  assert.equal((await owner.patch(`/api/admin/users/${me.id}`, { role: 'editor' })).status, 400, 'cannot demote yourself');
  assert.equal((await owner.delete(`/api/admin/users/${me.id}`)).status, 400, 'cannot delete yourself');

  // Deactivating an account ends its session immediately.
  assert.equal((await owner.patch(`/api/admin/users/${created.data.id}`, { isActive: false })).status, 200);
  assert.equal((await editor.get('/api/admin/overview')).status, 401);
  assert.equal((await editor.login(EDITOR)).status, 401);
  assert.equal((await owner.delete(`/api/admin/users/${created.data.id}`)).status, 200);
});

test('changing the password signs out other sessions and replaces the credentials', async () => {
  const otherDevice = client();
  await otherDevice.login(OWNER);
  assert.equal((await otherDevice.get('/api/auth/me')).status, 200);

  const wrong = await owner.post('/api/auth/change-password', { currentPassword: 'not-it', newPassword: 'brand-new-password-9' });
  assert.equal(wrong.status, 400);
  const changed = await owner.post('/api/auth/change-password', { currentPassword: OWNER.password, newPassword: 'brand-new-password-9' });
  assert.equal(changed.status, 200);

  assert.equal((await owner.get('/api/auth/me')).status, 200, 'the current session continues');
  assert.equal((await otherDevice.get('/api/auth/me')).status, 401, 'other sessions are revoked');
  assert.equal((await client().login(OWNER)).status, 401, 'the old password no longer works');
  assert.equal((await client().login({ email: OWNER.email, password: 'brand-new-password-9' })).status, 200);

  await owner.post('/api/auth/logout');
  assert.equal((await owner.get('/api/auth/me')).status, 401);
  await owner.login({ email: OWNER.email, password: 'brand-new-password-9' });
});

test('login attempts are rate limited per account', async () => {
  let limited = false;
  for (let attempt = 0; attempt < 10 && !limited; attempt += 1) {
    limited = (await client().login({ email: 'victim@test.local', password: 'guess-number-' + attempt })).status === 429;
  }
  assert.ok(limited);
  await db.query('DELETE FROM rate_limits');
});

test('SEO: sitemap, robots and server-rendered vehicle metadata', async () => {
  const sitemap = await anon.get('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.ok(sitemap.data.includes(`${base}/vehicles/${vehicle.slug}</loc>`));
  assert.equal((sitemap.data.match(/<url>/g) || []).length, 23 + 4);
  const robots = await anon.get('/robots.txt');
  assert.ok(robots.data.includes('Disallow: /admin'));
  assert.ok(robots.data.includes(`Sitemap: ${base}/sitemap.xml`));
});

test('data persists across a full server and connection-pool restart', async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.closePool();
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  const detail = await anon.get(`/api/vehicles/${vehicle.slug}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.price, 2500000);
  assert.equal(detail.data.images.length, 3);
  assert.equal((await owner.get('/api/auth/me')).status, 200, 'sessions survive a restart (stateless tokens)');
});

test('deleting a vehicle removes it everywhere, including its stored photos', async () => {
  const images = (await owner.get(`/api/admin/vehicles/${vehicle.id}`)).data.images.filter((image) => image.uploaded);
  assert.equal(images.length, 2);
  assert.ok(images.every((image) => fs.existsSync(fileFor(image.url))));

  assert.equal((await owner.delete(`/api/admin/brands/${brandId}`)).status, 409, 'a brand in use cannot be deleted');
  assert.equal((await owner.delete(`/api/admin/vehicles/${vehicle.id}`)).status, 200);
  assert.equal((await owner.delete(`/api/admin/vehicles/${vehicle.id}`)).status, 404);
  assert.equal((await anon.get(`/api/vehicles/${vehicle.slug}`)).status, 404);
  assert.equal((await anon.get('/api/vehicles?pageSize=60')).data.total, 22);
  assert.ok(images.every((image) => !fs.existsSync(fileFor(image.url)) && !fs.existsSync(fileFor(image.thumbUrl))));

  const inquiry = (await owner.get('/api/admin/inquiries')).data.items.find((item) => item.type === 'test_drive');
  assert.equal(inquiry.vehicleId, null);
  assert.equal(inquiry.vehicleTitle, '2025 Pagani Automobili Utopia Roadster', 'inquiries keep the vehicle name');

  assert.equal((await owner.delete(`/api/admin/brands/${brandId}`)).status, 200);
  assert.equal((await owner.delete(`/api/admin/categories/${categoryId}`)).status, 200);
});
