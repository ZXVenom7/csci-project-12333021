import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useSite } from '../lib/SiteContext';

function Login({ onLogin }) {
  const { settings } = useSite();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.post('/auth/login', { email, password });
      onLogin(result.user);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <div className="app-shell admin-shell admin-login">
      <div className="content-box">
        <h1 className="admin-login-brand">{settings.dealership.name}</h1>
        <h2>Administrator Sign In</h2>
        {error ? <div className="error-alert" role="alert">{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email">Email Address</label>
            <input id="login-email" type="email" required autoComplete="username" autoFocus
              value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" required autoComplete="current-password"
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button type="submit" className="submit-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
        </form>
        <p className="admin-login-back"><Link to="/">← Back to website</Link></p>
      </div>
    </div>
  );
}

export default Login;
