# Luxury Motor Sport

A database-driven car dealership platform: the public React site plus a secure admin dashboard for managing
inventory, photos, pricing, inquiries and site content without touching the code.

- **Frontend:** React 19 (Create React App), React Router 6. The original design, palette and components are unchanged.
- **Backend:** Node.js + Express 5 REST API in `server/`. Runs as a Vercel serverless function (`api/index.js`) or as a
  standalone server that also serves the built frontend.
- **Database:** PostgreSQL (any provider: Supabase, Neon, Vercel Postgres, self-hosted) with SQL migrations.
- **Images:** uploaded photos are validated, re-encoded to optimised WebP (1920px + 640px thumbnail) and stored on
  local disk (dev / VPS) or any S3-compatible bucket (Supabase Storage, Cloudflare R2, AWS S3).

## Quick start (local)

Requirements: Node.js 20+ and a PostgreSQL 13+ database.

```bash
npm install
cp .env.example .env          # then set DATABASE_URL and JWT_SECRET
npm run db:migrate            # create the tables
npm run db:seed               # optional: import the 22 original listings, brands and categories
npm run admin:create          # create your owner account (prompts for email, name, password)
npm run dev                   # API on :4000 + React dev server on :3000
```

Open http://localhost:3000 for the site and http://localhost:3000/admin for the dashboard.

Generate a `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Admin dashboard (`/admin`)

| Section | What it does |
| --- | --- |
| Overview | Total / available / reserved / sold counts, inventory value, new inquiries, recently added vehicles |
| Vehicles | Search, filter, add, edit, delete; change availability, publish/unpublish and feature inline |
| Vehicle editor | Every vehicle field, plus photos: multi-upload (drag and drop), primary photo, reorder, delete, add by URL |
| Pricing | Edit prices in bulk view, set a previous price, apply a % promotion, end a promotion |
| Brands & Categories | Add, rename, delete (a brand that still has vehicles cannot be deleted) |
| Inquiries | Contact messages, appointment / test-drive requests, availability checks; status and internal notes |
| Site Content (owner) | Dealership name, about text, address, phone, email, WhatsApp, opening hours, currency, page copy |
| Administrators (owner) | Create accounts, change role, deactivate, reset password, delete |
| My Account | Change your password (signs out your other devices) |

**Roles.** `owner` can do everything. `editor` manages vehicles, photos, pricing, brands, categories and inquiries,
but cannot change site content or administrator accounts.

New vehicles are saved as **drafts**; tick **Published** to put them on the website.

## Environment variables

See [`.env.example`](.env.example) for the annotated list. Never commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (use the pooled string on serverless hosts) |
| `JWT_SECRET` | yes | Signs admin sessions; at least 32 random characters |
| `DATABASE_SSL` | no | `true` for hosted Postgres (default in production), `false` locally |
| `SITE_URL` | recommended | Public site address; used for the sitemap, canonical URLs and link previews |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` (required on Vercel) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE` | with `s3` | Bucket credentials and its public base URL |
| `UPLOAD_DIR`, `UPLOAD_MAX_MB`, `MAX_IMAGES_PER_VEHICLE` | no | Upload location (local driver) and limits (8 MB, 30 photos) |
| `SESSION_HOURS`, `API_PORT`, `DATABASE_POOL_MAX`, `TRUST_PROXY` | no | Session length (12 h), port (4000), pool size (5), proxy hops (1) |
| `CORS_ORIGINS`, `COOKIE_SAMESITE`, `REACT_APP_API_URL` | no | Only when the frontend and API are on different origins |

## Database

Migrations live in `server/db/migrations/*.sql` and are applied in order by `npm run db:migrate`, which records
them in `schema_migrations` and is safe to re-run. To change the schema, add a new numbered `.sql` file.

```
users ──────────── administrators (bcrypt hash, role owner|editor, is_active, token_version)
brands ──┐
         ├──< vehicles >── categories        vehicles.brand_id    → brands      (required, delete restricted)
         │        │                          vehicles.category_id → categories  (optional, set null on delete)
         │        ├──< vehicle_images        vehicle_images.vehicle_id → vehicles (cascade; one primary per vehicle)
         │        └──< inquiries             inquiries.vehicle_id → vehicles    (set null; title snapshot kept)
settings ───────── editable site content (JSON)
rate_limits ────── counters for login / inquiry throttling
```

`vehicles` columns: `slug`, `brand_id`, `category_id`, `model`, `year`, `price`, `previous_price`, `mileage`,
`transmission_type`, `transmission`, `fuel_type`, `engine`, `horsepower`, `fuel_economy`, `exterior_color`,
`interior_color`, `body_type`, `drivetrain`, `vin`, `condition`, `status` (`available|reserved|sold`),
`is_published`, `is_featured`, `description`, `created_at`, `updated_at`.

A discount is derived, never stored: when `previous_price > price` the API returns
`discount: { amount, percent }` and the site shows the old price struck through.

## API

All routes are under `/api`. Errors are `{ "error": { "message", "fields"? } }`.

**Public**

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Database connectivity check |
| GET | `/site` | Dealership info, contact details, currency, page copy |
| GET | `/vehicles` | Published inventory. Filters: `q`, `brand`, `category`, `model`, `bodyType`, `fuelType`, `transmission`, `condition`, `status`, `featured`, `minYear`, `maxYear`, `minPrice`, `maxPrice`, `maxMileage`. `sort`: `recommended`, `newest`, `price_asc`, `price_desc`, `year_desc`, `mileage_asc`, `power_desc`. Paging: `page`, `pageSize` (max 60) |
| GET | `/vehicles/facets` | Filter options with counts and year / price ranges |
| GET | `/vehicles/:slug` | One published vehicle with all photos |
| GET | `/brands`, `/categories` | Lists |
| POST | `/inquiries` | `type`: `general`, `appointment`, `test_drive`, `availability`. Rate limited |

**Auth** (session cookie: HttpOnly, SameSite=Strict, Secure in production)

| Method | Path |
| --- | --- |
| POST | `/auth/login`, `/auth/logout`, `/auth/change-password` |
| GET | `/auth/me` |

**Admin** (signed-in administrators only; mutating requests must send `X-Requested-With: XMLHttpRequest`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/overview` | Dashboard statistics |
| GET, POST | `/admin/vehicles` | List (includes drafts; extra filter `published`) / create |
| GET, PUT, PATCH, DELETE | `/admin/vehicles/:id` | `PATCH` accepts any subset, e.g. `{ "price": 79900 }` or `{ "status": "sold" }` |
| POST | `/admin/vehicles/:id/images` | Multipart field `images` (JPEG, PNG, WebP) |
| POST | `/admin/vehicles/:id/images/url` | Reference an external `https://` image |
| PUT | `/admin/vehicles/:id/images/order` | `{ "imageIds": [...] }` |
| PATCH, DELETE | `/admin/images/:imageId` | `{ "isPrimary": true }`, `{ "alt": "..." }` |
| GET, POST, PUT, DELETE | `/admin/brands[/:id]`, `/admin/categories[/:id]` | |
| GET, PATCH, DELETE | `/admin/inquiries[/:id]` | Filters `status`, `type`, `page` |
| GET, PUT | `/admin/settings` | `PUT` is owner only |
| GET, POST, PATCH, DELETE | `/admin/users[/:id]` | Owner only |

Also served by the backend: `/sitemap.xml`, `/robots.txt`, and `/vehicles/:slug` HTML with per-vehicle title,
description, Open Graph tags (link previews) and schema.org `Car` JSON-LD.

## Deployment

### Vercel (current host) + hosted Postgres + S3-compatible storage

1. **Database.** Create a PostgreSQL database (Supabase, Neon or Vercel Postgres) and copy its *pooled* connection string.
2. **Storage.** Create a public bucket (Supabase Storage, Cloudflare R2 or AWS S3) and S3 access keys. Vercel's
   filesystem is read-only, so `STORAGE_DRIVER=s3` is required there.
3. **Environment.** In Vercel → Project → Settings → Environment Variables add `DATABASE_URL`, `JWT_SECRET`,
   `SITE_URL`, `STORAGE_DRIVER=s3` and the `S3_*` variables.
4. **Schema and first admin.** From your computer, with the same `DATABASE_URL` in `.env` and `DATABASE_SSL=true`:
   `npm run db:migrate`, optionally `npm run db:seed`, then `npm run admin:create`.
5. **Deploy.** Push to the connected branch. Keep the Create React App preset (build `npm run build`, output `build`).
   `vercel.json` routes `/api/*`, `/vehicles/*`, `/sitemap.xml` and `/robots.txt` to the Express function.

### Single server (VPS, Render, Railway, Fly.io)

```bash
npm ci && npm run build
npm run db:migrate
npm run start:prod            # serves the API and the built site on $PORT (default 4000)
```

Put it behind HTTPS. With `STORAGE_DRIVER=local`, keep `uploads/` on a persistent disk and back it up.

## Security

- Passwords hashed with bcrypt (cost 12); no credentials in the code or repository.
- Sessions are signed, HttpOnly, SameSite cookies; every request re-checks the account, so deactivating a user or
  changing a password revokes access immediately.
- CSRF defence: SameSite cookie + required custom header + Origin check on every mutation.
- All input validated server-side (zod); all SQL is parameterised.
- Uploads: type detected from file contents, size capped, re-encoded with sharp (strips EXIF/GPS), random file names.
- Rate limiting (stored in Postgres, so it holds across serverless instances) on login, password change and inquiries.
- Security headers and a Content-Security-Policy via helmet; CORS is same-origin unless `CORS_ORIGINS` is set.
- Errors return safe messages; details are logged server-side only.

## Tests

```bash
npm test                      # frontend unit tests (API mocked)
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/dealership_test npm run test:api
npm run lint
```

`test:api` runs 22 end-to-end API tests against a real database. It **wipes** the target database, so it refuses
any database whose name does not end in `_test`.

## Project structure

```text
api/index.js            Vercel serverless entry (wraps the Express app)
server/
  app.js, index.js      Express app and standalone entry
  config.js             Environment configuration
  db/                   Connection pool, migration runner, SQL migrations
  lib/                  Auth, validation, rate limiting, image processing, storage drivers, settings
  routes/               public.js, auth.js, admin/*
  scripts/              seed.js (legacy inventory import), create-admin.js
  seo.js                sitemap, robots, vehicle page metadata
  tests/                API integration tests
src/
  App.js, App.css       Router and the original styles
  components/, pages/   Public site (inventory, vehicle page, about, contact, booking)
  admin/                Dashboard (loaded on demand)
  lib/                  API client, formatting, site settings context
```

## Image credits

- Mercedes-AMG GT Black Series image: Wikimedia Commons, Alexander-93
- Audi R8 V10 Performance image: Wikimedia Commons, Calreyn88
- Lucid Air Sapphire image: Wikimedia Commons, Calreyn88
