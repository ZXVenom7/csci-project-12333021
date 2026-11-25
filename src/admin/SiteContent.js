import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { useSite } from '../lib/SiteContext';
import { useAuth } from './auth';
import { Field, Notice, useNotice } from './ui';

const lines = (value) => value.split('\n').map((line) => line.trim()).filter(Boolean);
const paragraphs = (value) => value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);

function toForm(settings) {
  return {
    name: settings.dealership.name,
    aboutHeading: settings.dealership.aboutHeading,
    about: settings.dealership.aboutParagraphs.join('\n\n'),
    address: settings.contact.addressLines.join('\n'),
    email: settings.contact.email,
    phone: settings.contact.phone,
    whatsapp: settings.contact.whatsapp,
    hours: settings.contact.hours,
    currencyCode: settings.currency.code,
    currencyLocale: settings.currency.locale,
    distanceUnit: settings.distanceUnit,
    inventoryHeading: settings.content.inventoryHeading,
    inventoryIntro: settings.content.inventoryIntro,
    featuredHeading: settings.content.featuredHeading,
    bookingHeading: settings.content.bookingHeading,
    bookingIntro: settings.content.bookingIntro,
  };
}

// Server field path -> form field, for showing validation messages.
const ERROR_MAP = {
  'dealership.name': 'name', 'dealership.aboutHeading': 'aboutHeading', 'contact.email': 'email',
  'contact.phone': 'phone', 'contact.whatsapp': 'whatsapp', 'contact.hours': 'hours',
  'currency.code': 'currencyCode', 'currency.locale': 'currencyLocale',
  'content.inventoryHeading': 'inventoryHeading', 'content.inventoryIntro': 'inventoryIntro',
  'content.featuredHeading': 'featuredHeading', 'content.bookingHeading': 'bookingHeading',
  'content.bookingIntro': 'bookingIntro',
};

function SiteContent() {
  const { reload } = useSite();
  const { guard } = useAuth();
  const notice = useNotice();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/settings').then((settings) => setForm(toForm(settings))).catch((failure) => {
      guard(failure);
      notice.error(failure);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!form) return <><div className="admin-page-head"><h2>Site Content</h2></div><Notice notice={notice.notice} /></>;

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const saved = await api.put('/admin/settings', {
        dealership: { name: form.name, aboutHeading: form.aboutHeading, aboutParagraphs: paragraphs(form.about) },
        contact: { addressLines: lines(form.address), email: form.email, phone: form.phone, whatsapp: form.whatsapp, hours: form.hours },
        currency: { code: form.currencyCode, locale: form.currencyLocale },
        distanceUnit: form.distanceUnit,
        content: {
          inventoryHeading: form.inventoryHeading, inventoryIntro: form.inventoryIntro,
          featuredHeading: form.featuredHeading, bookingHeading: form.bookingHeading, bookingIntro: form.bookingIntro,
        },
      });
      setForm(toForm(saved));
      await reload();
      notice.success('Saved. The website has been updated.');
    } catch (failure) {
      guard(failure);
      const mapped = {};
      Object.entries(failure.fields || {}).forEach(([path, message]) => {
        const key = ERROR_MAP[path] || (path.startsWith('contact.addressLines') ? 'address' : path.startsWith('dealership.aboutParagraphs') ? 'about' : path);
        mapped[key] = message;
      });
      setErrors(mapped);
      notice.error(failure);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const input = (key, label, props = {}, hint) => (
    <Field label={label} htmlFor={`s-${key}`} error={errors[key]} hint={hint}>
      <input id={`s-${key}`} value={form[key]} onChange={set(key)} {...props} />
    </Field>
  );
  const area = (key, label, rows, hint) => (
    <Field label={label} htmlFor={`s-${key}`} error={errors[key]} hint={hint} className="span-all">
      <textarea id={`s-${key}`} rows={rows} value={form[key]} onChange={set(key)} />
    </Field>
  );

  let sample = '';
  try {
    sample = formatMoney(82200, { code: form.currencyCode.toUpperCase(), locale: form.currencyLocale });
  } catch {
    sample = '';
  }

  return (
    <>
      <div className="admin-page-head"><h2>Site Content</h2></div>
      <Notice notice={notice.notice} />
      <form className="admin-form" onSubmit={save} noValidate>
        <fieldset>
          <legend>Dealership</legend>
          <div className="form-grid">
            {input('name', 'Dealership Name', { required: true, maxLength: 80 }, 'Shown in the header and browser tab.')}
            {input('aboutHeading', 'About Page Heading', { required: true, maxLength: 120 })}
            {area('about', 'About Page Text', 8, 'Leave a blank line between paragraphs.')}
          </div>
        </fieldset>
        <fieldset>
          <legend>Contact Information</legend>
          <div className="form-grid">
            {area('address', 'Showroom Address', 3, 'One line per row.')}
            {input('email', 'Email', { type: 'email', maxLength: 254 })}
            {input('phone', 'Phone', { maxLength: 40 })}
            {input('whatsapp', 'WhatsApp Number', { maxLength: 20, placeholder: 'e.g. 96170000000' },
              'Full international number. Leave empty to hide the WhatsApp buttons.')}
            {input('hours', 'Opening Hours', { maxLength: 200, placeholder: 'e.g. Mon–Sat, 9:00–18:00' })}
          </div>
        </fieldset>
        <fieldset>
          <legend>Currency &amp; Units</legend>
          <div className="form-grid">
            {input('currencyCode', 'Currency Code', { required: true, maxLength: 3, style: { textTransform: 'uppercase' } },
              sample ? `Prices will look like ${sample}.` : 'A 3-letter code such as USD, EUR, AED, LBP.')}
            {input('currencyLocale', 'Number Format', { required: true, maxLength: 35 }, 'A locale such as en-US, fr-FR or ar-LB.')}
            <Field label="Distance Unit" htmlFor="s-distanceUnit" error={errors.distanceUnit}
              hint="Only changes the label; stored mileage values are not converted.">
              <select id="s-distanceUnit" value={form.distanceUnit} onChange={set('distanceUnit')}>
                <option value="mi">Miles</option>
                <option value="km">Kilometres</option>
              </select>
            </Field>
          </div>
        </fieldset>
        <fieldset>
          <legend>Page Text</legend>
          <div className="form-grid">
            {input('inventoryHeading', 'Inventory Heading', { required: true, maxLength: 120 })}
            {input('featuredHeading', 'Featured Section Heading', { required: true, maxLength: 120 },
              'The section appears when at least one vehicle is marked Featured.')}
            {area('inventoryIntro', 'Inventory Introduction', 2)}
            {input('bookingHeading', 'Booking Page Heading', { required: true, maxLength: 120 })}
            {area('bookingIntro', 'Booking Page Introduction', 2)}
          </div>
        </fieldset>
        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </form>
    </>
  );
}

export default SiteContent;
