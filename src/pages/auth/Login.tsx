import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle, FiX, FiCheckCircle,
  FiUsers, FiBookOpen, FiCalendar, FiBarChart2, FiDollarSign, FiTruck, FiArrowLeft,
} from 'react-icons/fi';
import { IoSchoolOutline } from 'react-icons/io5';
import { login, getMe, forgotPassword, verifyOtp, resetPassword } from '../../api/auth';
import { getMyStudentProfile } from '../../api/students';
import { getMyTeacherProfile } from '../../api/teachers';
import { useAuthStore } from '../../stores/authStore';
import { ROUTE_PATHS } from '../../utils/constants';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot-password modal state
  const [showForgot, setShowForgot] = useState(false);
  const [fpStep, setFpStep] = useState<'email' | 'otp' | 'password' | 'done'>('email');
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpResetToken, setFpResetToken] = useState('');
  const [fpNewPw, setFpNewPw] = useState('');
  const [fpConfirmPw, setFpConfirmPw] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpInfo, setFpInfo] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const openForgot = () => {
    setShowForgot(true);
    setFpStep('email');
    setFpEmail(email || '');
    setFpOtp(''); setFpResetToken('');
    setFpNewPw(''); setFpConfirmPw('');
    setFpError(''); setFpInfo('');
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError(''); setFpInfo('');
    if (!fpEmail) { setFpError('Enter your email'); return; }
    setFpLoading(true);
    try {
      await forgotPassword(fpEmail);
      setFpInfo('If that email is registered, a 6-digit code has been sent.');
      setFpStep('otp');
    } catch (err: any) {
      setFpError(err?.response?.data?.detail || 'Could not send code. Try again.');
    } finally { setFpLoading(false); }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError(''); setFpInfo('');
    if (fpOtp.trim().length < 4) { setFpError('Enter the code from your email'); return; }
    setFpLoading(true);
    try {
      const { reset_token } = await verifyOtp(fpEmail, fpOtp.trim());
      setFpResetToken(reset_token);
      setFpStep('password');
    } catch (err: any) {
      setFpError(err?.response?.data?.detail || 'Invalid or expired code');
    } finally { setFpLoading(false); }
  };

  const submitNewPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError(''); setFpInfo('');
    if (fpNewPw.length < 4) { setFpError('Password must be at least 4 characters'); return; }
    if (fpNewPw !== fpConfirmPw) { setFpError('Passwords do not match'); return; }
    setFpLoading(true);
    try {
      await resetPassword(fpResetToken, fpNewPw);
      setFpStep('done');
    } catch (err: any) {
      setFpError(err?.response?.data?.detail || 'Could not reset password');
    } finally { setFpLoading(false); }
  };

  const { setAuth, setStudentProfileId, setTeacherProfileId } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setError('');
    setLoading(true);

    try {
      // 1. Get tokens from login
      const tokens = await login(email, password);
      
      // 2. Temporarily set token so API calls work
      useAuthStore.getState().setAuth(tokens.access_token, tokens.refresh_token, {} as any);

      // 3. Fetch user data with the token
      const user = await getMe();
      
      // 4. Validate that user has a role
      if (!user.role) {
        setError('User role not found. Please contact support.');
        return;
      }
      
      // 5. Update auth store with complete user data
      setAuth(tokens.access_token, tokens.refresh_token, user);

      // 6. Fetch and store persistent profile IDs based on role
      const userRole = user.role?.trim() || '';
      if (userRole === 'STUDENT') {
        try {
          const studentProfile = await getMyStudentProfile();
          if (studentProfile?.id) {
            setStudentProfileId(studentProfile.id);
          }
        } catch (err) {
          console.warn('Could not fetch student profile:', err);
        }
      } else if (userRole === 'TEACHER') {
        try {
          const teacherProfile = await getMyTeacherProfile();
          if (teacherProfile?.id) {
            setTeacherProfileId(teacherProfile.id);
          }
        } catch (err) {
          console.warn('Could not fetch teacher profile:', err);
        }
      }

      // 7. Determine dashboard path based on role
      const dashboardPath = (ROUTE_PATHS as Record<string, string>)[userRole];
      
      if (!dashboardPath) {
        setError(`Unknown user role: ${user.role}. Please contact support.`);
        return;
      }
      
      // 8. Navigate to role-specific dashboard
      navigate(`${dashboardPath}/dashboard`, { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid credentials. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <FiUsers />,       label: 'Student & Staff Management' },
    { icon: <FiBookOpen />,    label: 'Daily Diary & Homework' },
    { icon: <FiCalendar />,    label: 'Attendance Tracking' },
    { icon: <FiBarChart2 />,   label: 'Analytics & Reports' },
    { icon: <FiDollarSign />,  label: 'Fee Collection' },
    { icon: <FiTruck />,       label: 'Transport Management' },
  ];

  return (
    <div className="login-wrapper">
      {/* Left — Branding */}
      <div className="login-left">
        <div className="login-brand">
          <div className="logo-icon">
            <IoSchoolOutline />
          </div>
          <h1>EduVerse</h1>
          <p>The complete school management platform that empowers educators and engages students</p>
        </div>
        <div className="login-features">
          {features.map((f, i) => (
            <div key={i} className="login-feature-chip">
              {f.icon}
              {f.label}
            </div>
          ))}
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="login-right">
        <form className="login-card" onSubmit={handleSubmit} id="login-form">
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to your account to continue</p>

          {error && (
            <div className="login-alert error">
              <FiAlertCircle />
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-icon-wrapper">
              <FiMail className="icon-left" />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="admin@school.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-icon-wrapper">
              <FiLock className="icon-left" />
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="icon-right"
                onClick={() => setShowPw(!showPw)}
                aria-label="Toggle password visibility"
              >
                {showPw ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <a href="#" className="forgot-link" onClick={e => { e.preventDefault(); openForgot(); }}>Forgot password?</a>

          <button type="submit" className="btn btn-primary" disabled={loading} id="login-btn">
            {loading ? (
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>

      {/* ─── Forgot Password modal ─── */}
      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>
                {fpStep === 'email' && '🔑 Forgot Password'}
                {fpStep === 'otp' && '📧 Enter Verification Code'}
                {fpStep === 'password' && '🔒 Set New Password'}
                {fpStep === 'done' && '✓ Password Reset'}
              </h3>
              <button className="btn-icon" onClick={() => setShowForgot(false)}><FiX /></button>
            </div>

            {/* Stepper */}
            {fpStep !== 'done' && (
              <div style={{ display: 'flex', gap: 6, padding: '0 1rem', marginTop: 8 }}>
                {(['email', 'otp', 'password'] as const).map((s, i) => {
                  const active = ['email', 'otp', 'password'].indexOf(fpStep) >= i;
                  return (
                    <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: active ? 'var(--primary-500)' : 'var(--gray-200)' }} />
                  );
                })}
              </div>
            )}

            <div className="modal-body">
              {fpError && (
                <div className="login-alert error" style={{ marginBottom: 12 }}>
                  <FiAlertCircle /> {fpError}
                </div>
              )}
              {fpInfo && !fpError && (
                <div style={{ padding: '10px 12px', background: 'var(--success-50)', color: 'var(--success-700)', borderRadius: 'var(--radius-md)', marginBottom: 12, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FiCheckCircle /> {fpInfo}
                </div>
              )}

              {/* Step 1: email */}
              {fpStep === 'email' && (
                <form onSubmit={submitEmail}>
                  <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)', marginBottom: 12 }}>
                    Enter your registered email and we'll send you a verification code.
                  </p>
                  <div className="form-group">
                    <label>Email address</label>
                    <div className="input-icon-wrapper">
                      <FiMail className="icon-left" />
                      <input type="email" className="form-input" required autoFocus placeholder="you@school.edu" value={fpEmail} onChange={e => setFpEmail(e.target.value)} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={fpLoading} style={{ width: '100%', marginTop: 8 }}>
                    {fpLoading ? 'Sending…' : 'Send Code'}
                  </button>
                </form>
              )}

              {/* Step 2: OTP */}
              {fpStep === 'otp' && (
                <form onSubmit={submitOtp}>
                  <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)', marginBottom: 12 }}>
                    We sent a 6-digit code to <strong>{fpEmail}</strong>. Enter it below. The code expires in 10 minutes.
                  </p>
                  <div className="form-group">
                    <label>Verification code</label>
                    <input type="text" className="form-input" required autoFocus inputMode="numeric" maxLength={6} placeholder="000000" value={fpOtp} onChange={e => setFpOtp(e.target.value.replace(/\D/g, ''))} style={{ fontSize: '1.5rem', letterSpacing: '0.5em', textAlign: 'center', fontWeight: 700 }} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={fpLoading} style={{ width: '100%', marginTop: 8 }}>
                    {fpLoading ? 'Verifying…' : 'Verify Code'}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => { setFpStep('email'); setFpInfo(''); setFpError(''); }}>
                    <FiArrowLeft /> Use a different email
                  </button>
                  <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', textAlign: 'center', marginTop: 10 }}>
                    Didn't receive it? <a href="#" onClick={e => { e.preventDefault(); submitEmail(e); }} style={{ color: 'var(--primary-600)' }}>Resend code</a>
                  </p>
                </form>
              )}

              {/* Step 3: new password */}
              {fpStep === 'password' && (
                <form onSubmit={submitNewPw}>
                  <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)', marginBottom: 12 }}>
                    Choose a new password for <strong>{fpEmail}</strong>.
                  </p>
                  <div className="form-group">
                    <label>New password</label>
                    <div className="input-icon-wrapper">
                      <FiLock className="icon-left" />
                      <input type="password" className="form-input" required autoFocus minLength={4} placeholder="At least 4 characters" value={fpNewPw} onChange={e => setFpNewPw(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Confirm new password</label>
                    <div className="input-icon-wrapper">
                      <FiLock className="icon-left" />
                      <input type="password" className="form-input" required minLength={4} placeholder="Re-enter password" value={fpConfirmPw} onChange={e => setFpConfirmPw(e.target.value)} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={fpLoading} style={{ width: '100%', marginTop: 8 }}>
                    {fpLoading ? 'Saving…' : 'Update Password'}
                  </button>
                </form>
              )}

              {/* Step 4: success */}
              {fpStep === 'done' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'var(--success-50)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <FiCheckCircle size={36} style={{ color: 'var(--success-600)' }} />
                  </div>
                  <h3 style={{ margin: 0 }}>Password updated!</h3>
                  <p style={{ color: 'var(--gray-600)', fontSize: '0.88rem', marginTop: 6 }}>
                    You can now sign in with your new password.
                  </p>
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => { setShowForgot(false); setEmail(fpEmail); setPassword(''); }}>
                    Back to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
