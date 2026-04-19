"use client";

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Zap } from 'lucide-react';
import './signin.css';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { redirect: false, email, password });
    if (res?.error) { setError('Invalid email or password.'); setLoading(false); }
    else router.push('/');
  };

  return (
    <div className="signin-page">
      {/* Left panel – brand */}
      <div className="signin-brand">
        <div className="brand-inner">
          <div className="brand-logo">
            <Zap size={22} color="white" strokeWidth={2.5} />
          </div>
          <div className="brand-name">DreamShift</div>
          <p className="brand-tagline">
            The project management platform built for high-performance teams.
          </p>

          <div className="brand-features">
            {['Workspace & project hierarchy', 'Kanban, List & Calendar views', 'Time tracking & analytics', 'Role-based access control'].map(f => (
              <div key={f} className="brand-feature-item">
                <div className="brand-feature-dot" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="brand-footer">DreamShift EMS · Enterprise Edition</p>
      </div>

      {/* Right panel – form */}
      <div className="signin-form-panel">
        <div className="signin-form-inner">
          <div className="signin-header">
            <h1>Welcome back</h1>
            <p>Sign in to your workspace</p>
          </div>

          {error && <div className="signin-error">{error}</div>}

          <form onSubmit={handleSubmit} className="signin-form">
            <div className="form-field">
              <label>Email address</label>
              <div className="input-wrap">
                <Mail size={14} className="input-icon" />
                <input
                  type="email"
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <div className="field-label-row">
                <label>Password</label>
                <button type="button" className="forgot-link">Forgot password?</button>
              </div>
              <div className="input-wrap">
                <Lock size={14} className="input-icon" />
                <input
                  type="password"
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="signin-btn" disabled={loading}>
              {loading ? (
                <span className="signin-spinner" />
              ) : (
                <>Sign in <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <p className="signin-footer-note">
            Don&apos;t have an account?{' '}
            <span className="contact-admin">Contact your administrator</span>
          </p>
        </div>
      </div>
    </div>
  );
}
