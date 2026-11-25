import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { CONDITION_LABELS, FUEL_LABELS, STATUS_LABELS, TRANSMISSION_LABELS, formatMoney } from '../lib/format';
import { useSite } from '../lib/SiteContext';
import { useAuth } from './auth';
import ImageManager from './ImageManager';
import { Field, Notice, useNotice } from './ui';

const BLANK = {
  brandId: '', categoryId: '', model: '', year: String(new Date().getFullYear()), price: '', previousPrice: '',
  mileage: '', transmissionType: '', transmission: '', fuelType: '', engine: '', horsepower: '', fuelEconomy: '',
  exteriorColor: '', interiorColor: '', bodyType: '', drivetrain: '', vin: '', condition: 'used',
  status: 'available', isPublished: false, isFeatured: false, description: '',
};
const BODY_TYPES = ['Coupe', 'Convertible', 'Sedan', 'SUV', 'Hatchback', 'Wagon', 'Pickup', 'Van'];
const DRIVETRAINS = ['RWD', 'FWD', 'AWD', '4WD'];

function toForm(vehicle) {
  const form = {};
  Object.keys(BLANK).forEach((key) => {
    const value = key === 'brandId' ? vehicle.brand.id : key === 'categoryId' ? vehicle.category && vehicle.category.id : vehicle[key];
    form[key] = typeof BLANK[key] === 'boolean' ? Boolean(value) : value === null || value === undefined ? '' : String(value);
  });
  return form;
}

function VehicleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSite();
  const { guard } = useAuth();
  const notice = useNotice();
  const [form, setForm] = useState(BLANK);
  const [vehicle, setVehicle] = useState(null);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/admin/brands'), api.get('/admin/categories')])
      .then(([brandList, categoryList]) => {
        setBrands(brandList);
        setCategories(categoryList);
      })
      .catch(guard);
  }, [guard]);

  useEffect(() => {
    setErrors({});
    if (!id) {
      setVehicle(null);
      setForm(BLANK);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get(`/admin/vehicles/${id}`)
      .then((result) => {
        setVehicle(result);
        setForm(toForm(result));
        setLoadError(null);
        if (location.state && location.state.created) {
          notice.success(result.isPublished
            ? 'Vehicle saved. Add its photos below.'
            : 'Vehicle saved as a draft. Add photos below, then tick "Published" to put it on the website.');
        } else {
          notice.clear();
        }
      })
      .catch((failure) => {
        guard(failure);
        setLoadError(failure);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, guard]);

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      if (id) {
        const updated = await api.put(`/admin/vehicles/${id}`, form);
        setVehicle(updated);
        setForm(toForm(updated));
        notice.success('Changes saved. The website is already showing them.');
      } else {
        const created = await api.post('/admin/vehicles', form);
        navigate(`/admin/vehicles/${created.id}`, { replace: true, state: { created: true } });
      }
    } catch (failure) {
      guard(failure);
      setErrors(failure.fields || {});
      notice.error(failure);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${vehicle.title}" and all of its photos? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/vehicles/${id}`);
      navigate('/admin/vehicles', { replace: true });
    } catch (failure) {
      guard(failure);
      notice.error(failure);
    }
  };

  if (loadError) {
    return (
      <>
        <div className="error-alert" role="alert">{loadError.message}</div>
        <Link to="/admin/vehicles">← Back to vehicles</Link>
      </>
    );
  }

  // Also covers the first render after navigating from "new" to the saved vehicle.
  if (loading || (id && (!vehicle || vehicle.id !== id))) return <p className="admin-muted" role="status">Loading…</p>;

  const price = Number(form.price);
  const previous = Number(form.previousPrice);
  const discount = form.price !== '' && form.previousPrice !== '' && previous > price
    ? { amount: previous - price, percent: Math.round(((previous - price) / previous) * 100) }
    : null;

  const input = (key, label, props = {}, hint) => (
    <Field label={label} htmlFor={`v-${key}`} error={errors[key]} hint={hint}>
      <input id={`v-${key}`} value={form[key]} onChange={set(key)} {...props} />
    </Field>
  );
  const select = (key, label, options, placeholder) => (
    <Field label={label} htmlFor={`v-${key}`} error={errors[key]}>
      <select id={`v-${key}`} value={form[key]} onChange={set(key)}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </Field>
  );

  return (
    <>
      <div className="admin-page-head">
        <h2>{id ? vehicle.title : 'Add Vehicle'}</h2>
        <div className="head-actions">
          {id && vehicle.isPublished ? (
            <a className="small-btn" href={`/vehicles/${vehicle.slug}`} target="_blank" rel="noopener noreferrer">View on site ↗</a>
          ) : null}
          <Link className="small-btn" to="/admin/vehicles">← All vehicles</Link>
        </div>
      </div>
      <Notice notice={notice.notice} />
      {!brands.length ? (
        <div className="error-alert">Add at least one brand under <Link to="/admin/brands">Brands &amp; Categories</Link> before creating vehicles.</div>
      ) : null}

      <form onSubmit={save} className="admin-form" noValidate>
        <fieldset>
          <legend>Vehicle</legend>
          <div className="form-grid">
            {select('brandId', 'Brand *', brands.map((brand) => [brand.id, brand.name]), 'Choose a brand')}
            {input('model', 'Model *', { required: true, maxLength: 120, placeholder: 'e.g. 911 Carrera' })}
            {input('year', 'Model Year *', { type: 'number', required: true, min: 1886, max: 2100 })}
            {select('categoryId', 'Category', categories.map((category) => [category.id, category.name]), 'None')}
            {select('condition', 'Condition', Object.entries(CONDITION_LABELS))}
            {input('vin', 'VIN (optional)', { maxLength: 17, placeholder: '17 characters', style: { textTransform: 'uppercase' } })}
          </div>
        </fieldset>

        <fieldset>
          <legend>Pricing &amp; Availability</legend>
          <div className="form-grid">
            {input('price', `Price (${settings.currency.code})`, { type: 'number', min: 0, step: '0.01', placeholder: 'Leave empty for "Price on request"' })}
            {input('previousPrice', `Previous Price (${settings.currency.code})`, { type: 'number', min: 0, step: '0.01', placeholder: 'Optional' },
              discount
                ? `Shows as a ${discount.percent}% discount (save ${formatMoney(discount.amount, settings.currency)}).`
                : 'Set a higher previous price to show a discount.')}
            {select('status', 'Availability', Object.entries(STATUS_LABELS))}
          </div>
          <div className="check-row">
            <label className="check"><input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} /> Published (visible on the website)</label>
            <label className="check"><input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} /> Featured on the homepage</label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Specifications</legend>
          <div className="form-grid">
            {input('mileage', `Mileage (${settings.distanceUnit === 'km' ? 'km' : 'miles'})`, { type: 'number', min: 0, step: 1 })}
            {input('engine', 'Engine', { maxLength: 80, placeholder: 'e.g. 4.0L Twin-Turbo V8' })}
            {input('horsepower', 'Horsepower', { type: 'number', min: 0, step: 1 })}
            {select('transmissionType', 'Transmission', Object.entries(TRANSMISSION_LABELS), 'Not specified')}
            {input('transmission', 'Transmission Detail', { maxLength: 80, placeholder: 'e.g. 8-Speed PDK' })}
            {select('fuelType', 'Fuel Type', Object.entries(FUEL_LABELS), 'Not specified')}
            {input('fuelEconomy', 'Fuel Economy', { maxLength: 60, placeholder: 'e.g. 16 / 23 MPG' })}
            {input('drivetrain', 'Drivetrain', { maxLength: 60, list: 'drivetrain-options' })}
            {input('bodyType', 'Body Type', { maxLength: 60, list: 'body-type-options' })}
            {input('exteriorColor', 'Exterior Color', { maxLength: 60 })}
            {input('interiorColor', 'Interior Color', { maxLength: 60 })}
          </div>
          <datalist id="drivetrain-options">{DRIVETRAINS.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="body-type-options">{BODY_TYPES.map((value) => <option key={value} value={value} />)}</datalist>
        </fieldset>

        <fieldset>
          <legend>Description</legend>
          <Field label="Detailed Description" htmlFor="v-description" error={errors.description}
            hint="Shown on the vehicle page. Leave a blank line between paragraphs.">
            <textarea id="v-description" rows={8} maxLength={10000} value={form.description} onChange={set('description')} />
          </Field>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={saving || !brands.length}>
            {saving ? 'Saving…' : id ? 'Save Changes' : 'Save & Add Photos'}
          </button>
          {id ? <button type="button" className="small-btn danger" onClick={remove}>Delete Vehicle</button> : null}
        </div>
      </form>

      {id ? (
        <ImageManager vehicle={vehicle} onChange={setVehicle} />
      ) : (
        <p className="admin-muted">Photos can be uploaded right after the vehicle is saved.</p>
      )}
    </>
  );
}

export default VehicleForm;
