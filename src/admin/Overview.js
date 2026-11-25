import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatMoney, formatNumber } from '../lib/format';
import { useSite } from '../lib/SiteContext';
import { useAuth } from './auth';
import { PageState, StatusPill, useLoad } from './ui';

function Overview() {
  const { settings } = useSite();
  const { guard } = useAuth();
  const { data, error, loading } = useLoad(() => api.get('/admin/overview').catch((failure) => {
    guard(failure);
    throw failure;
  }), []);

  const stats = data ? [
    ['Total vehicles', formatNumber(data.totalVehicles), '/admin/vehicles'],
    ['Available', formatNumber(data.available), '/admin/vehicles?status=available'],
    ['Reserved', formatNumber(data.reserved), '/admin/vehicles?status=reserved'],
    ['Sold', formatNumber(data.sold), '/admin/vehicles?status=sold'],
    ['Inventory value', formatMoney(data.inventoryValue, settings.currency), '/admin/pricing', 'Asking prices of unsold stock'],
    ['New inquiries', formatNumber(data.newInquiries), '/admin/inquiries?status=new'],
  ] : [];

  return (
    <>
      <div className="admin-page-head">
        <h2>Overview</h2>
        <Link className="submit-btn link-btn" to="/admin/vehicles/new">+ Add Vehicle</Link>
      </div>
      <PageState loading={loading} error={error}>
        {data ? (
          <>
            <div className="stat-grid">
              {stats.map(([label, value, to, hint]) => (
                <Link key={label} to={to} className="stat-card">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">{value}</span>
                  {hint ? <span className="stat-hint">{hint}</span> : null}
                </Link>
              ))}
            </div>
            {data.unpublished ? (
              <p className="admin-muted">
                {data.unpublished} vehicle(s) are saved as drafts and hidden from the website.{' '}
                <Link to="/admin/vehicles?published=false">Review drafts</Link>
              </p>
            ) : null}

            <h3 className="admin-subhead">Recently added</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Vehicle</th><th>Price</th><th>Status</th><th>Added</th></tr>
                </thead>
                <tbody>
                  {data.recentVehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>
                        <Link className="vehicle-cell" to={`/admin/vehicles/${vehicle.id}`}>
                          {vehicle.primaryImage ? <img src={vehicle.primaryImage.thumbUrl} alt="" /> : <span className="thumb-empty" />}
                          <span>{vehicle.title}{vehicle.isPublished ? '' : ' (draft)'}</span>
                        </Link>
                      </td>
                      <td>{vehicle.price !== null ? formatMoney(vehicle.price, settings.currency) : '—'}</td>
                      <td><StatusPill status={vehicle.status} /></td>
                      <td>{formatDate(vehicle.createdAt)}</td>
                    </tr>
                  ))}
                  {!data.recentVehicles.length ? (
                    <tr><td colSpan="4" className="admin-muted">No vehicles yet. Add your first one.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </PageState>
    </>
  );
}

export default Overview;
