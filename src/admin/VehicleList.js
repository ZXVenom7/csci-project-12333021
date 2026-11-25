import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { STATUS_LABELS, formatDate, formatMoney } from '../lib/format';
import { useSite } from '../lib/SiteContext';
import Pagination from '../components/Pagination';
import { useAuth } from './auth';
import { Notice, PageState, useLoad, useNotice } from './ui';

function VehicleList() {
  const { settings } = useSite();
  const { guard } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const notice = useNotice();
  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);

  const { data, error, loading, reload, setData } = useLoad(
    () => api.get('/admin/vehicles', { ...query, pageSize: 20 }).catch((failure) => {
      guard(failure);
      throw failure;
    }),
    [params.toString()],
  );
  const brands = useLoad(() => api.get('/admin/brands'), []);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (search === (params.get('q') || '')) return undefined;
    const timer = window.setTimeout(() => update({ q: search.trim() }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const patch = async (vehicle, changes, message) => {
    try {
      const updated = await api.patch(`/admin/vehicles/${vehicle.id}`, changes);
      setData((current) => ({ ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) }));
      notice.success(message);
    } catch (failure) {
      guard(failure);
      notice.error(failure);
    }
  };

  const remove = async (vehicle) => {
    if (!window.confirm(`Delete "${vehicle.title}" and all of its photos? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/vehicles/${vehicle.id}`);
      notice.success(`${vehicle.title} was deleted.`);
      reload();
    } catch (failure) {
      guard(failure);
      notice.error(failure);
    }
  };

  return (
    <>
      <div className="admin-page-head">
        <h2>Vehicles{data ? ` (${data.total})` : ''}</h2>
        <Link className="submit-btn link-btn" to="/admin/vehicles/new">+ Add Vehicle</Link>
      </div>
      <Notice notice={notice.notice} />

      <div className="admin-filters">
        <input type="search" aria-label="Search vehicles" placeholder="Search make, model, year, VIN…"
          value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filter by status" value={query.status || ''} onChange={(event) => update({ status: event.target.value })}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Filter by brand" value={query.brand || ''} onChange={(event) => update({ brand: event.target.value })}>
          <option value="">All brands</option>
          {(brands.data || []).map((brand) => <option key={brand.id} value={brand.slug}>{brand.name}</option>)}
        </select>
        <select aria-label="Filter by visibility" value={query.published || ''} onChange={(event) => update({ published: event.target.value })}>
          <option value="">Published &amp; drafts</option>
          <option value="true">Published</option>
          <option value="false">Drafts</option>
        </select>
        <select aria-label="Sort" value={query.sort || ''} onChange={(event) => update({ sort: event.target.value })}>
          <option value="">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="price_desc">Price: high to low</option>
          <option value="price_asc">Price: low to high</option>
          <option value="year_desc">Year: newest</option>
        </select>
      </div>

      <PageState loading={loading} error={error}>
        {data ? (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Vehicle</th><th>Price</th><th>Status</th><th>Published</th><th>Featured</th><th>Added</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>
                        <Link className="vehicle-cell" to={`/admin/vehicles/${vehicle.id}`}>
                          {vehicle.primaryImage ? <img src={vehicle.primaryImage.thumbUrl} alt="" /> : <span className="thumb-empty" />}
                          <span>{vehicle.title}</span>
                        </Link>
                      </td>
                      <td>
                        {vehicle.price !== null ? formatMoney(vehicle.price, settings.currency) : '—'}
                        {vehicle.discount ? <span className="admin-discount"> −{vehicle.discount.percent}%</span> : null}
                      </td>
                      <td>
                        <select className={`status-select status-${vehicle.status}`} aria-label={`Status of ${vehicle.title}`}
                          value={vehicle.status}
                          onChange={(event) => patch(vehicle, { status: event.target.value },
                            `${vehicle.title} marked ${STATUS_LABELS[event.target.value].toLowerCase()}.`)}>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                      <td>
                        <label className="toggle">
                          <input type="checkbox" checked={vehicle.isPublished}
                            onChange={(event) => patch(vehicle, { isPublished: event.target.checked },
                              `${vehicle.title} ${event.target.checked ? 'published' : 'unpublished'}.`)} />
                          <span className="sr-only">Published: {vehicle.title}</span>
                        </label>
                      </td>
                      <td>
                        <label className="toggle">
                          <input type="checkbox" checked={vehicle.isFeatured}
                            onChange={(event) => patch(vehicle, { isFeatured: event.target.checked },
                              `${vehicle.title} ${event.target.checked ? 'added to' : 'removed from'} featured.`)} />
                          <span className="sr-only">Featured: {vehicle.title}</span>
                        </label>
                      </td>
                      <td>{formatDate(vehicle.createdAt)}</td>
                      <td className="row-actions">
                        <Link className="small-btn" to={`/admin/vehicles/${vehicle.id}`}>Edit</Link>
                        <button type="button" className="small-btn danger" onClick={() => remove(vehicle)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {!data.items.length ? (
                    <tr><td colSpan="7" className="admin-muted">No vehicles match these filters.</td></tr>
                  ) : null}
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

export default VehicleList;
