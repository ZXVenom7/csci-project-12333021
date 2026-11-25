import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { INQUIRY_TYPE_LABELS, formatDate } from '../lib/format';
import Pagination from '../components/Pagination';
import { useAuth } from './auth';
import { Notice, PageState, StatusPill, useLoad, useNotice } from './ui';

const STATUS_OPTIONS = [['new', 'New'], ['in_progress', 'In progress'], ['closed', 'Closed']];

function InquiryRow({ inquiry, onChange, onDelete, onError }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(inquiry.adminNotes);

  const patch = async (changes) => {
    try {
      onChange(await api.patch(`/admin/inquiries/${inquiry.id}`, changes));
    } catch (failure) {
      onError(failure);
    }
  };

  return (
    <>
      <tr className={inquiry.status === 'new' ? 'row-new' : ''}>
        <td>{formatDate(inquiry.createdAt)}</td>
        <td>{INQUIRY_TYPE_LABELS[inquiry.type]}</td>
        <td>
          <strong>{inquiry.name}</strong><br />
          <a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>
          {inquiry.phone ? <><br /><a href={`tel:${inquiry.phone.replace(/[^+\d]/g, '')}`}>{inquiry.phone}</a></> : null}
        </td>
        <td>
          {inquiry.vehicleTitle || <span className="admin-muted">—</span>}
          {inquiry.preferredDate ? <><br /><span className="admin-muted">Preferred: {formatDate(inquiry.preferredDate)}</span></> : null}
        </td>
        <td>
          <select className="status-select" aria-label={`Status of inquiry from ${inquiry.name}`} value={inquiry.status}
            onChange={(event) => patch({ status: event.target.value })}>
            {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </td>
        <td className="row-actions">
          <button type="button" className="small-btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Open'}</button>
          <button type="button" className="small-btn danger" onClick={() => onDelete(inquiry)}>Delete</button>
        </td>
      </tr>
      {open ? (
        <tr className="row-detail">
          <td colSpan="6">
            <p className="admin-label">Message</p>
            <p className="multiline">{inquiry.message || <span className="admin-muted">No message.</span>}</p>
            <label htmlFor={`notes-${inquiry.id}`}>Internal notes (never shown to the customer)</label>
            <textarea id={`notes-${inquiry.id}`} rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
            <div className="form-actions">
              <button type="button" className="small-btn primary" disabled={notes === inquiry.adminNotes}
                onClick={() => patch({ adminNotes: notes })}>Save notes</button>
              <StatusPill status={inquiry.status} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Inquiries() {
  const { guard } = useAuth();
  const notice = useNotice();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const { data, error, loading, reload, setData } = useLoad(
    () => api.get('/admin/inquiries', query).catch((failure) => {
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

  const fail = (failure) => {
    guard(failure);
    notice.error(failure);
  };

  const remove = async (inquiry) => {
    if (!window.confirm(`Delete the inquiry from ${inquiry.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/inquiries/${inquiry.id}`);
      notice.success('Inquiry deleted.');
      reload();
    } catch (failure) {
      fail(failure);
    }
  };

  return (
    <>
      <div className="admin-page-head"><h2>Inquiries{data ? ` (${data.total})` : ''}</h2></div>
      <Notice notice={notice.notice} />
      <div className="admin-filters">
        <select aria-label="Filter by status" value={query.status || ''} onChange={(event) => update({ status: event.target.value })}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Filter by type" value={query.type || ''} onChange={(event) => update({ type: event.target.value })}>
          <option value="">All types</option>
          {Object.entries(INQUIRY_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <PageState loading={loading} error={error}>
        {data ? (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Received</th><th>Type</th><th>Customer</th><th>Vehicle</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {data.items.map((inquiry) => (
                    <InquiryRow key={inquiry.id} inquiry={inquiry} onDelete={remove} onError={fail}
                      onChange={(updated) => setData((current) => ({
                        ...current,
                        items: current.items.map((item) => (item.id === updated.id ? { ...item, ...updated, vehicleSlug: item.vehicleSlug } : item)),
                      }))} />
                  ))}
                  {!data.items.length ? <tr><td colSpan="6" className="admin-muted">No inquiries yet. Requests sent from the website appear here.</td></tr> : null}
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

export default Inquiries;
