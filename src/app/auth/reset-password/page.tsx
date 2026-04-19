"use client";

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldAlert } from 'lucide-react';
import './reset-password.css';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordShell loading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordShell({ loading }: { loading: boolean }) {
  return (
    <div className="reset-password-page">
      <div className="reset-password-card">
        <Link href="/auth/signin" className="reset-password-back-link">
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div className="reset-password-header">
          <div className="reset-password-icon">
            <Mail size={18} />
          </div>
          <h1>{loading ? 'Loading password reset' : 'Forgot password'}</h1>
          <p>Prepare your account email or reset link.</p>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = String(searchParams.get('token') || '');

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const requestMode = !token;

  async function handleRequestReset(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || 'Unable to send reset link');
      setSuccess('If your account exists, we sent a reset link to your email.');
      setEmail('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send reset link');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || 'Unable to reset password');
      setSuccess('Password updated successfully. You can sign in now.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-card">
        <Link href="/auth/signin" className="reset-password-back-link">
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div className="reset-password-header">
          <div className="reset-password-icon">
            {requestMode ? <Mail size={18} /> : <KeyRound size={18} />}
          </div>
          <h1>{requestMode ? 'Forgot password' : 'Reset password'}</h1>
          <p>
            {requestMode
              ? 'Enter your account email and we will send a secure reset link.'
              : 'Enter your new password to complete the reset.'}
          </p>
        </div>

        {error ? (
          <div className="reset-password-message error"><ShieldAlert size={14} /> {error}</div>
        ) : null}
        {success ? (
          <div className="reset-password-message success"><CheckCircle2 size={14} /> {success}</div>
        ) : null}

        {requestMode ? (
          <form onSubmit={handleRequestReset} className="reset-password-form">
            <label className="reset-password-field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="reset-password-form">
            <label className="reset-password-field">
              <span>New password</span>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </label>
            <label className="reset-password-field">
              <span>Confirm new password</span>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat new password"
                required
                minLength={8}
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}