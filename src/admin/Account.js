import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './auth';
import { Field, Notice, useNotice } from './ui';

const BLANK = { currentPassword: '', newPassword: '', confirm: '' };

function Account() {
  const { user, guard } = useAuth();
  const notice = useNotice();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setErrors({});
    if (form.newPassword !== form.confirm) {
      setErrors({ confirm: 'The two passwords do not match' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm(BLANK);
      notice.success('Password changed. Other devices have been signed out.');
    } catch (failure) {
      guard(failure);
      setErrors(failure.fields || {});
      notice.error(failure);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="admin-page-head"><h2>My Account</h2></div>
      <p className="admin-muted">Signed in as {user.name} ({user.email}) · {user.role}</p>
      <Notice notice={notice.notice} />
      <form className="admin-form narrow" onSubmit={save} noValidate>
        <fieldset>
          <legend>Change password</legend>
          <Field label="Current Password" htmlFor="a-current" error={errors.currentPassword}>
            <input id="a-current" type="password" required autoComplete="current-password"
              value={form.currentPassword} onChange={set('currentPassword')} />
          </Field>
          <Field label="New Password" htmlFor="a-new" error={errors.newPassword} hint="At least 10 characters.">
            <input id="a-new" type="password" required minLength={10} autoComplete="new-password"
              value={form.newPassword} onChange={set('newPassword')} />
          </Field>
          <Field label="Confirm New Password" htmlFor="a-confirm" error={errors.confirm}>
            <input id="a-confirm" type="password" required autoComplete="new-password"
              value={form.confirm} onChange={set('confirm')} />
          </Field>
          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={saving}>{saving ? 'Saving…' : 'Change Password'}</button>
          </div>
        </fieldset>
      </form>
    </>
  );
}

export default Account;
