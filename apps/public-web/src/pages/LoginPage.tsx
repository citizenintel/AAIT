import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useAppStore } from '../store/app-store';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const isAuth = useAppStore((s) => s.auth.isAuthenticated);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAuth) {
    navigate('/admin');
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@altafrikaner.com' && password === 'demo') {
      login({
        id: 'usr-001',
        email: 'admin@altafrikaner.com',
        displayName: 'Admin',
        role: 'platform_admin',
      });
      navigate('/admin');
    } else if (email === 'editor@altafrikaner.com' && password === 'demo') {
      login({
        id: 'usr-002',
        email: 'editor@altafrikaner.com',
        displayName: 'Senior Editor',
        role: 'senior_editor',
      });
      navigate('/admin');
    } else {
      setError('Invalid credentials. Use demo accounts listed below.');
    }
  };

  return (
    <div className="app-shell" style={{ gridTemplateColumns: '1fr' }}>
      <TopBar />
      <div className="page-content">
        <div className="page-container" style={{ maxWidth: 420, paddingTop: 60 }}>
          <div className="login-card">
            <h1>Sign in</h1>
            <p className="login-subtitle">Access the editorial dashboard</p>

            <form onSubmit={handleLogin}>
              {error && <div className="login-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@altafrikaner.com" autoComplete="email" />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                Sign in
              </button>
            </form>

            <div className="login-demo">
              <h3>Demo accounts</h3>
              <p>For development and testing only:</p>
              <div className="demo-account">
                <code>admin@altafrikaner.com</code> / <code>demo</code>
                <span className="demo-role">Platform Admin</span>
              </div>
              <div className="demo-account">
                <code>editor@altafrikaner.com</code> / <code>demo</code>
                <span className="demo-role">Senior Editor</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
