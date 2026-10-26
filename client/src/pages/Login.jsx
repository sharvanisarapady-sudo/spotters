import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <Link to="/" className="text-spotter-blue font-semibold text-sm">SPOTTERS.COM</Link>
        <h1 className="mt-4 text-2xl font-bold text-navy-950">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Log in to continue your radiology training.</p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-spotter-blue"
              placeholder="Your password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-spotter-blue text-white font-medium py-2.5 hover:bg-spotter-blue-dark transition disabled:opacity-60"
          >
            {submitting ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-spotter-blue font-medium">Get started</Link>
        </p>

        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 text-xs text-navy-800 px-3 py-2">
          Demo login — Email: <strong>demo@spotters.com</strong> · Password: <strong>Demo@1234</strong>
        </div>
      </div>
    </div>
  );
}
