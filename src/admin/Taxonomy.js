import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './auth';
import { Notice, PageState, useLoad, useNotice } from './ui';

function TaxonomyList({ title, singular, path, deleteHint }) {
  const { guard } = useAuth();
  const notice = useNotice();
  const { data, error, loading, reload } = useLoad(() => api.get(path), [path]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);

  const run = async (work, message) => {
    try {
      await work();
      notice.success(message);
      await reload();
      return true;
    } catch (failure) {
      guard(failure);
      notice.error(failure.fields && failure.fields.name ? failure.fields.name : failure);
      return false;
    }
  };

  const add = async (event) => {
    event.preventDefault();
    if (await run(() => api.post(path, { name }), `${name.trim()} added.`)) setName('');
  };

  const rename = async (event) => {
    event.preventDefault();
    if (await run(() => api.put(`${path}/${editing.id}`, { name: editing.name }), `${singular} renamed.`)) setEditing(null);
  };

  const remove = (item) => {
    if (!window.confirm(`Delete the ${singular.toLowerCase()} "${item.name}"?${item.vehicleCount ? ` ${deleteHint}` : ''}`)) return;
    run(() => api.delete(`${path}/${item.id}`), `${item.name} deleted.`);
  };

  return (
    <section className="admin-form taxonomy">
      <fieldset>
        <legend>{title}{data ? ` (${data.length})` : ''}</legend>
        <Notice notice={notice.notice} />
        <form className="inline-form" onSubmit={add}>
          <label htmlFor={`new-${singular}`}>Add a {singular.toLowerCase()}</label>
          <div className="inline-row">
            <input id={`new-${singular}`} required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
            <button type="submit" className="small-btn primary">Add</button>
          </div>
        </form>
        <PageState loading={loading} error={error}>
          {data ? (
            <ul className="taxonomy-list">
              {data.map((item) => (
                <li key={item.id}>
                  {editing && editing.id === item.id ? (
                    <form className="inline-row" onSubmit={rename}>
                      <input aria-label={`Rename ${item.name}`} required maxLength={60} autoFocus value={editing.name}
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                      <button type="submit" className="small-btn primary">Save</button>
                      <button type="button" className="small-btn" onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span className="taxonomy-name">{item.name}</span>
                      <span className="admin-muted">{item.vehicleCount} vehicle{item.vehicleCount === 1 ? '' : 's'}</span>
                      <span className="row-actions">
                        <button type="button" className="small-btn" onClick={() => setEditing({ id: item.id, name: item.name })}>Rename</button>
                        <button type="button" className="small-btn danger" onClick={() => remove(item)}>Delete</button>
                      </span>
                    </>
                  )}
                </li>
              ))}
              {!data.length ? <li className="admin-muted">Nothing here yet.</li> : null}
            </ul>
          ) : null}
        </PageState>
      </fieldset>
    </section>
  );
}

function Taxonomy() {
  return (
    <>
      <div className="admin-page-head"><h2>Brands &amp; Categories</h2></div>
      <div className="two-col">
        <TaxonomyList title="Brands" singular="Brand" path="/admin/brands"
          deleteHint="Brands that still have vehicles cannot be deleted." />
        <TaxonomyList title="Categories" singular="Category" path="/admin/categories"
          deleteHint="Its vehicles will be left without a category." />
      </div>
    </>
  );
}

export default Taxonomy;
