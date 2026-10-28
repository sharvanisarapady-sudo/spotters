import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [adminExists, setAdminExists] = useState(true);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [role, setRole] = useState('student'); // 'student' | 'admin'
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authService
      .adminStatus()
      .then((res) => {
        if (cancelled) return;
        setAdminExists(Boolean(res.adminExists));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const selectedRole = !adminExists && role === 'admin' ? 'admin' : 'student';
      const res = await register({ ...form, role: selectedRole });
      if (res.user?.role === 'admin') {
        navigate('/admin/cases');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <Link to="/" className="text-spotter-blue font-semibold text-sm">SPOTTERS.COM</Link>
        <h1 className="mt-4 text-2xl font-bold text-navy-950">
          {!adminExists && role === 'admin'
            ? 'Create Admin (Radiologist) Account'
            : 'Create Student Account'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {!adminExists && role === 'admin'
            ? 'One-time setup for the lead professional radiologist with full content & block management rights.'
            : 'General learner account for practicing radiology cases and taking timed spotter tests.'}
        </p>

        {/* Account Type Selector — Admin option only available until the 1 Admin account is created */}
        {!checkingAdmin && !adminExists ? (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Select Account Type</p>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setRole('student');
                  setError('');
                }}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  role === 'student'
                    ? 'bg-white text-navy-950 shadow-sm'
                    : 'text-gray-500 hover:text-navy-950'
                }`}
              >
                Student (General)
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('admin');
                  setError('');
                }}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  role === 'admin'
                    ? 'bg-navy-950 text-white shadow-sm'
                    : 'text-gray-500 hover:text-navy-950'
                }`}
              >
                Admin (Radiologist)
              </button>
            </div>
            {role === 'admin' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
                <strong>Note:</strong> Only <strong>one</strong> Admin (Professional Radiologist) account can be created. Once registered, all future signups will be Student accounts.
              </div>
            )}
          </div>
        ) : (
          !checkingAdmin && (
            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-xs px-3 py-2">
              Registering as a <strong>Student</strong> account. (The single Admin / Radiologist account has already been claimed.)
            </div>
          )
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy-900 mb-1">Full Name</label>
            <input
              name="fullName"
              required
              value={form.fullName}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-spotter-blue"
              placeholder={!adminExists && role === 'admin' ? 'Dr. Jane Doe' : 'Jane Doe'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-900 mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-spotter-blue"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-900 mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-spotter-blue"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-900 mb-1">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              required
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-spotter-blue"
              placeholder="Re-enter your password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-lg text-white font-medium py-2.5 transition disabled:opacity-60 ${
              !adminExists && role === 'admin'
                ? 'bg-navy-950 hover:bg-navy-900'
                : 'bg-spotter-blue hover:bg-spotter-blue-dark'
            }`}
          >
            {submitting
              ? 'Creating account…'
              : !adminExists && role === 'admin'
              ? 'Create Admin (Radiologist) Account'
              : 'Create Student Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-spotter-blue font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
