import React, { useState } from 'react';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok) {
        if (isLogin) {
          localStorage.setItem('token', data.token);
          onLogin(data.username);
        } else {
          alert('Account created successfully! Please log in.');
          setIsLogin(true);
          setPassword('');
        }
      } else {
        setError(data.error || 'An unexpected error occurred.');
      }
    } catch (err) {
      setError('Unable to connect to the server.');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1e293b', padding: '40px', borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)', width: '100%', maxWidth: '400px',
        border: '1px solid #334155'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ color: '#f8fafc', margin: '0 0 10px 0', fontSize: '24px' }}>
            ProxiSpeak Meet
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '10px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              padding: '12px 15px', borderRadius: '8px', border: '1px solid #334155',
              backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none', fontSize: '15px'
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: '12px 15px', borderRadius: '8px', border: '1px solid #334155',
              backgroundColor: '#0f172a', color: '#f8fafc', outline: 'none', fontSize: '15px'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '12px', borderRadius: '8px', border: 'none',
              backgroundColor: '#3b82f6', color: '#ffffff', fontSize: '16px',
              fontWeight: '600', cursor: 'pointer', marginTop: '10px'
            }}
          >
            {isLogin ? 'Access Dashboard' : 'Create Account'}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          style={{
            width: '100%', marginTop: '20px', background: 'transparent', border: 'none',
            color: '#94a3b8', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline'
          }}
        >
          {isLogin ? 'Need an account? Sign up here' : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  );
}