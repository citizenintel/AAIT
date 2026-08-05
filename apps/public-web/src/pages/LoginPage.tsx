import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/admin');
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const configured = isSupabaseConfigured();

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
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            {/* Demo accounts removed — will be re-added when needed */}
          </div>
        </div>
      </div>
    </div>
  );
}
