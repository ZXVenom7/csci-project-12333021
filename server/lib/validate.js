'use strict';

const { z } = require('zod');
const { badRequest } = require('./errors');

const TRANSMISSION_TYPES = ['automatic', 'manual', 'dual_clutch', 'single_speed'];
const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric'];
const CONDITIONS = ['new', 'used', 'certified'];
const STATUSES = ['available', 'reserved', 'sold'];
const INQUIRY_TYPES = ['general', 'appointment', 'test_drive', 'availability'];
const INQUIRY_STATUSES = ['new', 'in_progress', 'closed'];
const ROLES = ['owner', 'editor'];

/** Trims and removes control characters (keeps newlines/tabs when multiline). */
function clean(value, multiline = false) {
  // eslint-disable-next-line no-control-regex
  const pattern = multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g;
  return value.replace(pattern, multiline ? '' : ' ').trim();
}

const text = (max, { min = 0, multiline = false } = {}) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? clean(value, multiline) : value),
    z.string({ error: 'Required' }).min(min, min === 1 ? 'Required' : `Must be at least ${min} characters`)
      .max(max, `Must be ${max} characters or fewer`),
  );

/** Optional text: empty strings become null. */
const optionalText = (max, options) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) return null;
      if (typeof value === 'string') return clean(value, options && options.multiline) || null;
      return value;
    },
    z.string().max(max, `Must be ${max} characters or fewer`).nullable(),
  );

/** Optional number: empty string / null become null; numeric strings are accepted. */
const optionalNumber = (schema) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
    return value;
  }, schema.nullable());

const requiredNumber = (schema) =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
    return value;
  }, schema);

const optionalEnum = (values) =>
  z.preprocess((value) => (value === undefined || value === '' ? null : value), z.enum(values).nullable());

const money = z.number({ error: 'Enter a valid amount' }).min(0, 'Cannot be negative').max(9_999_999_999, 'Too large');
const email = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.email('Enter a valid email address').max(254),
);
const password = z.string({ error: 'Required' })
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be 128 characters or fewer');

const vehicleSchema = z.object({
  brandId: requiredNumber(z.number({ error: 'Choose a brand' }).int().positive()),
  categoryId: optionalNumber(z.number().int().positive()),
  model: text(120, { min: 1 }),
  year: requiredNumber(z.number({ error: 'Enter the model year' }).int().min(1886, 'Enter a valid year')
    .max(new Date().getFullYear() + 2, 'Enter a valid year')),
  price: optionalNumber(money),
  previousPrice: optionalNumber(money),
  mileage: optionalNumber(z.number({ error: 'Enter a whole number' }).int('Enter a whole number').min(0).max(9_999_999)),
  transmissionType: optionalEnum(TRANSMISSION_TYPES),
  transmission: optionalText(80),
  fuelType: optionalEnum(FUEL_TYPES),
  engine: optionalText(80),
  horsepower: optionalNumber(z.number({ error: 'Enter a whole number' }).int('Enter a whole number').min(0).max(10000)),
  fuelEconomy: optionalText(60),
  exteriorColor: optionalText(60),
  interiorColor: optionalText(60),
  bodyType: optionalText(60),
  drivetrain: optionalText(60),
  vin: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toUpperCase() || null : value ?? null),
    z.string().regex(/^[A-HJ-NPR-Z0-9]{11,17}$/, 'A VIN is 11-17 letters and digits (no I, O or Q)').nullable(),
  ),
  condition: z.enum(CONDITIONS).default('used'),
  status: z.enum(STATUSES).default('available'),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  description: z.preprocess(
    (value) => (typeof value === 'string' ? clean(value, true) : value ?? ''),
    z.string().max(10000, 'Must be 10,000 characters or fewer'),
  ),
});

// PATCH: any subset of fields, with no defaults filled in.
const vehiclePatchSchema = z.object(
  Object.fromEntries(Object.entries(vehicleSchema.shape).map(([key, schema]) => {
    const inner = schema instanceof z.ZodDefault ? schema.unwrap() : schema;
    return [key, inner.optional()];
  })),
);

const nameSchema = z.object({ name: text(60, { min: 1 }) });

const inquirySchema = z.object({
  type: z.enum(INQUIRY_TYPES).default('general'),
  vehicleId: z.preprocess((value) => value || null, z.uuid().nullable()),
  name: text(100, { min: 2 }),
  email,
  phone: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || null : value ?? null),
    z.string().regex(/^[+()\d\s.-]{6,25}$/, 'Enter a valid phone number').nullable(),
  ),
  message: z.preprocess(
    (value) => (typeof value === 'string' ? clean(value, true) : value ?? ''),
    z.string().max(2000, 'Must be 2,000 characters or fewer'),
  ),
  preferredDate: z.preprocess(
    (value) => value || null,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date').nullable(),
  ),
  // Honeypot: real visitors never fill this hidden field.
  website: z.string().max(200).optional(),
});

const inquiryPatchSchema = z.object({
  status: z.enum(INQUIRY_STATUSES).optional(),
  adminNotes: z.preprocess(
    (value) => (typeof value === 'string' ? clean(value, true) : value),
    z.string().max(4000).optional(),
  ),
});

const settingsSchema = z.object({
  dealership: z.object({
    name: text(80, { min: 1 }),
    aboutHeading: text(120, { min: 1 }),
    aboutParagraphs: z.array(text(2000, { min: 1, multiline: true })).max(10),
  }),
  contact: z.object({
    addressLines: z.array(text(120, { min: 1 })).max(5),
    email: z.union([z.literal(''), email]),
    phone: text(40),
    whatsapp: z.preprocess(
      (value) => (typeof value === 'string' ? value.replace(/[\s()+-]/g, '') : value),
      z.string().regex(/^(\d{7,15})?$/, 'Use the full international number, digits only'),
    ),
    hours: text(200),
  }),
  currency: z.object({
    code: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
      z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code, e.g. USD')
        .refine((code) => {
          try {
            new Intl.NumberFormat('en', { style: 'currency', currency: code });
            return true;
          } catch {
            return false;
          }
        }, 'Unknown currency code'),
    ),
    locale: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() : value),
      z.string().max(35).refine((locale) => {
        try {
          return Intl.NumberFormat.supportedLocalesOf([locale]).length > 0;
        } catch {
          return false;
        }
      }, 'Unknown locale, e.g. en-US'),
    ),
  }),
  distanceUnit: z.enum(['mi', 'km']),
  content: z.object({
    inventoryHeading: text(120, { min: 1 }),
    inventoryIntro: text(400),
    featuredHeading: text(120, { min: 1 }),
    bookingHeading: text(120, { min: 1 }),
    bookingIntro: text(400),
  }),
});

const loginSchema = z.object({ email, password: z.string({ error: 'Required' }).min(1, 'Required').max(128) });
const changePasswordSchema = z.object({
  currentPassword: z.string({ error: 'Required' }).min(1, 'Required').max(128),
  newPassword: password,
});
const userCreateSchema = z.object({ email, name: text(80, { min: 1 }), role: z.enum(ROLES), password });
const userPatchSchema = z.object({
  name: text(80, { min: 1 }).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: password.optional(),
});

/** Validates `data`, throwing a 400 with per-field messages on failure. */
function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw badRequest('Please check the highlighted fields.', { fields });
}

module.exports = {
  TRANSMISSION_TYPES,
  FUEL_TYPES,
  CONDITIONS,
  STATUSES,
  INQUIRY_TYPES,
  INQUIRY_STATUSES,
  ROLES,
  parse,
  vehicleSchema,
  vehiclePatchSchema,
  nameSchema,
  inquirySchema,
  inquiryPatchSchema,
  settingsSchema,
  loginSchema,
  changePasswordSchema,
  userCreateSchema,
  userPatchSchema,
};
