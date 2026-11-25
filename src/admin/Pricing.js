import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { useSite } from '../lib/SiteContext';
import Pagination from '../components/Pagination';
import { useAuth } from './auth';
import { Notice, PageState, StatusPill, useLoad, useNotice } from './ui';

const text = (value) => (value === null || value === undefined ? '' : String(value));

function PricingRow({ vehicle, currency, onSaved, onError }) {
  const [price, setPrice] = useState(text(vehicle.price));
  const [previous, setPrevious] = useState(text(vehicle.previousPrice));
  const [percent, setPercent] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = price !== text(vehicle.price) || previous !== text(vehicle.previousPrice);

  const save = async (changes, message) => {
    setBusy(true);
    try {
      const updated = await api.patch(`/admin/vehicles/${vehicle.id}`, changes);
      setPrice(text(updated.price));
      setPrevious(text(updated.previousPrice));
      setPercent('');
      onSaved(updated, message);
    } catch (failure) {
      onError(failure);
    } finally {
      setBusy(false);
    }
  };

  // A promotion keeps the original price as "previous" and lowers the current one.
  const applyPercent = () => {
    const base = vehicle.previousPrice ?? vehicle.price;
    const value = Number(percent);
    if (base === null || !(value > 0 && value < 100)) {
      onError(new Error('Enter a discount between 1 and 99%, on a vehicle that has a price.'));
      return;
    }
    save({ previousPrice: base, price: Math.round(base * (1 - value / 100)) },
      `${value}% promotion applied to ${vehicle.title}.`);
  };

  return (
    <tr>
      <td>
        <Link className="vehicle-cell" to={`/admin/vehicles/${vehicle.id}`}>
          {vehicle.primaryImage ? <img src={vehicle.primaryImage.thumbUrl} alt="" /> : <span className="thumb-empty" />}
          <span>{vehicle.title}</span>
        </Link>
      </td>
      <td><StatusPill status={vehicle.status} /></td>
      <td>
        <input className="price-input" type="number" min="0" step="0.01" aria-label={`Price of ${vehicle.title}`}
          placeholder="On request" value={price} onChange={(event) => setPrice(event.target.value)} />
      </td>
      <td>
        <input className="price-input" type="number" min="0" step="0.01" aria-label={`Previous price of ${vehicle.title}`}
          placeholder="—" value={previous} onChange={(event) => setPrevious(event.target.value)} />
      </td>
      <td>
        {vehicle.discount
          ? <span className="admin-discount">−{vehicle.discount.percent}% ({formatMoney(vehicle.discount.amount, currency)})</span>
          : <span className="admin-muted">—</span>}
      </td>
      <td className="row-actions">
        <button type="button" className="small-btn primary" disabled={!dirty || busy}
          onClick={() => save({ price, previousPrice: previous }, `Price updated for ${vehicle.title}.`)}>Save</button>
        <span className="promo">
          <input className="percent-input" type="number" min="1" max="99" placeholder="%" aria-label={`Discount percent for ${vehicle.title}`}
            value={percent} onChange={(event) => setPercent(event.target.value)} />
          <button type="button" className="small-btn" disabled={!percent || busy} onClick={applyPercent}>Apply %</button>
        </span>
        {vehicle.discount ? (
          <button type="button" className="small-btn" disabled={busy}
            onClick={() => save({ price: vehicle.previousPrice, previousPrice: null }, `Promotion ended for ${vehicle.title}.`)}>
            End promo
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function Pricing() {
  const { settings } = useSite();
  const { guard } = useAuth();
  const notice = useNotice();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const { data, error, loading, setData } = useLoad(
    () => api.get('/admin/vehicles', { ...query, pageSize: 25 }).catch((failure) => {
      guard(failure);
      throw failure;
    }),
    [params.toString()],
  );

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <>
      <div className="admin-page-head">
        <h2>Pricing</h2>
      </div>
      <p className="admin-muted">
        Prices are in {settings.currency.code}. A previous price higher than the current price is shown struck
        through on the website with the saving. Changes go live as soon as you save.
      </p>
      <Notice notice={notice.notice} />
      <div className="admin-filters">
        <form onSubmit={(event) => {
          event.preventDefault();
          update({ q: new FormData(event.target).get('q').trim() });
        }}>
          <input type="search" name="q" aria-label="Search vehicles" placeholder="Search and press Enter…" defaultValue={query.q || ''} />
        </form>
        <select aria-label="Filter by status" value={query.status || ''} onChange={(event) => update({ status: event.target.value })}>
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
        </select>
        <select aria-label="Sort" value={query.sort || ''} onChange={(event) => update({ sort: event.target.value })}>
          <option value="">Newest first</option>
          <option value="price_desc">Price: high to low</option>
          <option value="price_asc">Price: low to high</option>
        </select>
      </div>
      <PageState loading={loading} error={error}>
        {data ? (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Vehicle</th><th>Status</th><th>Price</th><th>Previous price</th><th>Discount</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {data.items.map((vehicle) => (
                    <PricingRow key={vehicle.id} vehicle={vehicle} currency={settings.currency}
                      onSaved={(updated, message) => {
                        setData((current) => ({ ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) }));
                        notice.success(message);
                      }}
                      onError={(failure) => {
                        guard(failure);
                        notice.error(failure.fields && Object.values(failure.fields)[0] ? Object.values(failure.fields)[0] : failure);
                      }} />
                  ))}
                  {!data.items.length ? <tr><td colSpan="6" className="admin-muted">No vehicles found.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages}
              onChange={(page) => update({ page: page === 1 ? '' : String(page) })} />
          </>
        ) : null}
      </PageState>
    </>
  );
}

export default Pricing;
