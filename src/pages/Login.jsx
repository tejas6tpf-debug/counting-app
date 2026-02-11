import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Info } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, debugInfo } = useAuth();

  const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPlaceholder) {
      setError('Connection not set! Restart run_app.bat');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      console.error('Login Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Lock size={32} />
          </div>
          <h1>Pegasus Spare</h1>
          <p>Annual Physical Stock Counting</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label><User size={16} /> Username</label>
            <input
              type="text"
              placeholder="pegasus.spare"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label><Lock size={16} /> Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {(debugInfo || isPlaceholder) && (
            <div className="debug-box">
              <Info size={16} />
              <div>
                <strong>Status:</strong> {isPlaceholder ? 'Credentials loading...' : debugInfo || 'Connecting to Supabase...'}
                {isPlaceholder && <p>Please restart <code>run_app.bat</code></p>}
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Super Admin: <code>pegasus.spare</code> / <code>spare321</code></p>
        </div>
      </div>

      <style jsx="true">{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          padding: 1rem;
        }
        .login-card {
          background: #1e293b;
          width: 100%;
          max-width: 400px;
          padding: 2.5rem;
          border-radius: 1.5rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .login-logo {
          width: 64px;
          height: 64px;
          background: #3b82f6;
          border-radius: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
        }
        .login-header h1 {
          font-size: 1.875rem;
          font-weight: 800;
          color: white;
          margin-bottom: 0.5rem;
        }
        .login-header p {
          color: #94a3b8;
          font-size: 0.875rem;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .form-group label {
          font-size: 0.875rem;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .form-group input {
          background: #0f172a;
          border: 1px solid #334155;
          color: white;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-group input:focus {
          border-color: #3b82f6;
        }
        .debug-box {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          padding: 1rem;
          border-radius: 0.75rem;
          font-size: 0.8rem;
          display: flex;
          gap: 0.75rem;
        }
        .error-message {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          padding: 0.75rem;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          text-align: center;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .login-button {
          background: #3b82f6;
          color: white;
          padding: 0.75rem;
          border-radius: 0.75rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .login-button:hover:not(:disabled) {
          background: #2563eb;
        }
        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .login-footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.75rem;
          color: #64748b;
        }
        .login-footer code {
          color: #3b82f6;
        }
      `}</style>
    </div>
  );
};

export default Login;
