import { useState } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { useAuth } from './auth';
import { Field, Notice, PageState, useLoad, useNotice } from './ui';

const BLANK = { name: '', email: '', role: 'editor', password: '' };

function Users() {
  const { user: me, guard } = useAuth();
  const notice = useNotice();
  const { data, error, loading, reload } = useLoad(() => api.get('/admin/users').catch((failure) => {
    guard(failure);
    throw failure;
  }), []);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});

  const run = async (work, message) => {
    try {
      await work();
      notice.success(message);
      reload();
      return true;
    } catch (failure) {
      guard(failure);
      setErrors(failure.fields || {});
      notice.error(failure);
      return false;
    }
  };

  const create = async (event) => {
    event.preventDefault();
    setErrors({});
    if (await run(() => api.post('/admin/users', form), `Account created for ${form.email}.`)) setForm(BLANK);
  };

  const resetPassword = (account) => {
    const password = window.prompt(`New password for ${account.email} (at least 10 characters). They will be signed out everywhere.`);
    if (password) run(() => api.patch(`/admin/users/${account.id}`, { password }), `Password reset for ${account.email}.`);
  };

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <>
      <div className="admin-page-head"><h2>Administrators</h2></div>
      <p className="admin-muted">
        Owners can do everything. Editors manage vehicles, photos, pricing, brands, categories and inquiries,
        but cannot change site content or administrator accounts.
      </p>
      <Notice notice={notice.notice} />
      <PageState loading={loading} error={error}>
        {data ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Last sign-in</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.map((account) => {
                  const self = account.id === me.id;
                  return (
                    <tr key={account.id}>
                      <td>{account.name}{self ? ' (you)' : ''}</td>
                      <td>{account.email}</td>
                      <td>
                        <select className="status-select" aria-label={`Role of ${account.email}`} value={account.role} disabled={self}
                          onChange={(event) => run(() => api.patch(`/admin/users/${account.id}`, { role: event.target.value }), 'Role updated.')}>
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                        </select>
                      </td>
                      <td>
                        <label className="toggle">
                          <input type="checkbox" checked={account.isActive} disabled={self}
                            onChange={(event) => run(() => api.patch(`/admin/users/${account.id}`, { isActive: event.target.checked }),
                              `${account.email} ${event.target.checked ? 'activated' : 'deactivated'}.`)} />
                          <span className="sr-only">Active: {account.email}</span>
                        </label>
                      </td>
                      <td>{account.lastLoginAt ? formatDate(account.lastLoginAt) : 'Never'}</td>
                      <td className="row-actions">
                        {!self ? (
                          <>
                            <button type="button" className="small-btn" onClick={() => resetPassword(account)}>Reset password</button>
                            <button type="button" className="small-btn danger"
                              onClick={() => window.confirm(`Delete the account ${account.email}?`)
                                && run(() => api.delete(`/admin/users/${account.id}`), 'Account deleted.')}>
                              Delete
                            </button>
                          </>
                        ) : <span className="admin-muted">Manage under My Account</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </PageState>

      <form className="admin-form" onSubmit={create} noValidate>
        <fieldset>
          <legend>Add an administrator</legend>
          <div className="form-grid">
            <Field label="Full Name" htmlFor="u-name" error={errors.name}>
              <input id="u-name" required maxLength={80} value={form.name} onChange={set('name')} />
            </Field>
            <Field label="Email" htmlFor="u-email" error={errors.email}>
              <input id="u-email" type="email" required autoComplete="off" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Role" htmlFor="u-role" error={errors.role}>
              <select id="u-role" value={form.role} onChange={set('role')}>
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </select>
            </Field>
            <Field label="Temporary Password" htmlFor="u-password" error={errors.password}
              hint="At least 10 characters. Ask them to change it after their first sign-in.">
              <input id="u-password" type="password" required minLength={10} autoComplete="new-password"
                value={form.password} onChange={set('password')} />
            </Field>
          </div>
          <div className="form-actions"><button type="submit" className="submit-btn">Create Account</button></div>
        </fieldset>
      </form>
    </>
  );
}

export default Users;
