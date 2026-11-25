import { useState } from 'react';
import { api } from '../lib/api';

const SUCCESS = {
  appointment: 'Appointment request sent successfully! We will contact you soon to confirm.',
  test_drive: 'Test drive request sent successfully! We will contact you soon to confirm.',
  availability: 'Thank you! We will confirm availability shortly.',
  general: 'Message sent successfully! We will get back to you soon.',
};

/**
 * Shared form behind the contact form, appointment booking, test-drive
 * requests and availability inquiries. Submissions are stored in the database
 * and appear in the admin dashboard.
 *
 * `vehicles` renders a vehicle picker; `vehicleId` fixes the vehicle instead.
 */
function InquiryForm({ type, vehicleId, vehicles, defaultVehicleId, submitLabel, idPrefix = 'inq' }) {
  const needsDate = type === 'appointment' || type === 'test_drive';
  const blank = { name: '', email: '', phone: '', message: '', preferredDate: '', website: '' };
  const [values, setValues] = useState(blank);
  const [selected, setSelected] = useState(defaultVehicleId || '');
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const picked = vehicleId || selected || (vehicles && vehicles.find((v) => v.status !== 'sold')?.id) || '';
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const today = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ state: 'sending', message: '' });
    setErrors({});
    try {
      await api.post('/inquiries', { ...values, type, vehicleId: picked || null });
      setValues(blank);
      setStatus({ state: 'sent', message: SUCCESS[type] });
    } catch (error) {
      setErrors(error.fields || {});
      setStatus({ state: 'error', message: error.message });
    }
  };

  const field = (name, label, input) => (
    <div>
      <label htmlFor={`${idPrefix}-${name}`}>{label}</label>
      {input}
      {errors[name] ? <p className="field-error" role="alert">{errors[name]}</p> : null}
    </div>
  );

  return (
    <>
      {status.state === 'sent' ? <div className="success-alert" role="status">{status.message}</div> : null}
      {status.state === 'error' ? <div className="error-alert" role="alert">{status.message}</div> : null}

      <form onSubmit={handleSubmit} noValidate={false}>
        {field('name', 'Full Name', (
          <input type="text" id={`${idPrefix}-name`} required minLength={2} maxLength={100} placeholder="John Doe"
            autoComplete="name" value={values.name} onChange={set('name')} />
        ))}
        {field('email', 'Email Address', (
          <input type="email" id={`${idPrefix}-email`} required maxLength={254} placeholder="john@example.com"
            autoComplete="email" value={values.email} onChange={set('email')} />
        ))}
        {field('phone', 'Phone (optional)', (
          <input type="tel" id={`${idPrefix}-phone`} maxLength={25} placeholder="+961 00 000 000"
            autoComplete="tel" value={values.phone} onChange={set('phone')} />
        ))}
        {vehicles ? field('vehicleId', 'Select Vehicle', (
          <select id={`${idPrefix}-vehicleId`} value={picked} onChange={(event) => setSelected(event.target.value)}>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id} disabled={vehicle.status === 'sold'}>
                {vehicle.title}{vehicle.status === 'sold' ? ' (Sold)' : ''}{vehicle.status === 'reserved' ? ' (Reserved)' : ''}
              </option>
            ))}
          </select>
        )) : null}
        {needsDate ? field('preferredDate', 'Preferred Date', (
          <input type="date" id={`${idPrefix}-preferredDate`} required min={today}
            value={values.preferredDate} onChange={set('preferredDate')} />
        )) : null}
        {field('message', type === 'general' ? 'Message' : 'Message (optional)', (
          <textarea id={`${idPrefix}-message`} rows={4} maxLength={2000} required={type === 'general'}
            value={values.message} onChange={set('message')} />
        ))}
        {/* Honeypot: hidden from people, tempting to bots. */}
        <div className="hp-field" aria-hidden="true">
          <label htmlFor={`${idPrefix}-website`}>Website</label>
          <input type="text" id={`${idPrefix}-website`} tabIndex={-1} autoComplete="off"
            value={values.website} onChange={set('website')} />
        </div>
        <button type="submit" className="submit-btn" disabled={status.state === 'sending'}>
          {status.state === 'sending' ? 'Sending…' : submitLabel}
        </button>
      </form>
    </>
  );
}

export default InquiryForm;
