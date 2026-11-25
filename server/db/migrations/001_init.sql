-- Luxury Motor Sport: initial schema.
-- gen_random_uuid() is built into PostgreSQL 13+ (no extension needed).

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  name            text NOT NULL,
  password_hash   text NOT NULL,
  role            text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor')),
  is_active       boolean NOT NULL DEFAULT true,
  -- Bumped on password change / deactivation to invalidate existing sessions.
  token_version   integer NOT NULL DEFAULT 0,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE brands (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX brands_name_key ON brands (lower(name));

CREATE TABLE categories (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_key ON categories (lower(name));

CREATE TABLE vehicles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE,
  brand_id           integer NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  category_id        integer REFERENCES categories (id) ON DELETE SET NULL,
  model              text NOT NULL,
  year               integer NOT NULL CHECK (year BETWEEN 1886 AND 2100),
  -- NULL price means "price on request".
  price              numeric(12, 2) CHECK (price IS NULL OR price >= 0),
  -- Optional original price; shown struck through when higher than `price`.
  previous_price     numeric(12, 2) CHECK (previous_price IS NULL OR previous_price >= 0),
  mileage            integer CHECK (mileage IS NULL OR mileage >= 0),
  transmission_type  text CHECK (transmission_type IS NULL OR transmission_type IN
                       ('automatic', 'manual', 'dual_clutch', 'single_speed')),
  transmission       text,
  fuel_type          text CHECK (fuel_type IS NULL OR fuel_type IN
                       ('petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric')),
  engine             text,
  horsepower         integer CHECK (horsepower IS NULL OR horsepower >= 0),
  fuel_economy       text,
  exterior_color     text,
  interior_color     text,
  body_type          text,
  drivetrain         text,
  vin                text,
  condition          text NOT NULL DEFAULT 'used' CHECK (condition IN ('new', 'used', 'certified')),
  status             text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
  is_published       boolean NOT NULL DEFAULT false,
  is_featured        boolean NOT NULL DEFAULT false,
  description        text NOT NULL DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vehicles_vin_key ON vehicles (upper(vin)) WHERE vin IS NOT NULL;
CREATE INDEX vehicles_public_idx ON vehicles (is_published, status, created_at DESC);
CREATE INDEX vehicles_brand_idx ON vehicles (brand_id);
CREATE INDEX vehicles_category_idx ON vehicles (category_id);
CREATE INDEX vehicles_price_idx ON vehicles (price);
CREATE INDEX vehicles_year_idx ON vehicles (year);

CREATE TABLE vehicle_images (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   uuid NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  url          text NOT NULL,
  thumb_url    text NOT NULL,
  -- Storage object keys; NULL for images referenced by external URL.
  storage_key  text,
  thumb_key    text,
  alt          text NOT NULL DEFAULT '',
  width        integer,
  height       integer,
  is_primary   boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicle_images_vehicle_idx ON vehicle_images (vehicle_id, sort_order);
-- At most one primary image per vehicle, enforced by the database.
CREATE UNIQUE INDEX vehicle_images_one_primary ON vehicle_images (vehicle_id) WHERE is_primary;

CREATE TABLE inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN ('general', 'appointment', 'test_drive', 'availability')),
  vehicle_id      uuid REFERENCES vehicles (id) ON DELETE SET NULL,
  -- Snapshot so the inquiry stays meaningful after the vehicle is deleted.
  vehicle_title   text,
  name            text NOT NULL,
  email           text NOT NULL,
  phone           text,
  message         text NOT NULL DEFAULT '',
  preferred_date  date,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'closed')),
  admin_notes     text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inquiries_status_idx ON inquiries (status, created_at DESC);

-- Editable site content (dealership info, contact details, currency, copy).
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Fixed-window counters backing the rate limiter. Stored in Postgres so the
-- limits hold across serverless instances.
CREATE TABLE rate_limits (
  key       text PRIMARY KEY,
  count     integer NOT NULL,
  reset_at  timestamptz NOT NULL
);
