import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('student'); // 'student' | 'admin'
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await login({ ...form, loginType });
      if (res.user?.role === 'admin') {
        navigate('/admin/cases');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <Link to="/" className="text-spotter-blue font-semibold text-sm">SPOTTERS.COM</Link>
        <h1 className="mt-4 text-2xl font-bold text-navy-950">
          {loginType === 'admin' ? 'Radiologist / Admin Login' : 'Student Login'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {loginType === 'admin'
            ? 'Professional radiologist portal — manage cases, answer keys, videos & test blocks.'
            : 'General learner portal — practice cases, take timed tests & track your progress.'}
        </p>

        {/* Role Selector Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => {
              setLoginType('student');
              setError('');
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition ${
              loginType === 'student'
                ? 'bg-white text-navy-950 shadow-sm'
                : 'text-gray-500 hover:text-navy-950'
            }`}
          >
            Student Login
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginType('admin');
              setError('');
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition ${
              loginType === 'admin'
                ? 'bg-navy-950 text-white shadow-sm'
                : 'text-gray-500 hover:text-navy-950'
            }`}
          >
            Admin (Radiologist)
          </button>
        </div>

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
              placeholder={loginType === 'admin' ? 'radiologist@example.com' : 'student@example.com'}
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
            className={`w-full rounded-lg text-white font-medium py-2.5 transition disabled:opacity-60 ${
              loginType === 'admin'
                ? 'bg-navy-950 hover:bg-navy-900'
                : 'bg-spotter-blue hover:bg-spotter-blue-dark'
            }`}
          >
            {submitting
              ? 'Logging in…'
              : loginType === 'admin'
              ? 'Login as Admin (Radiologist)'
              : 'Login as Student'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-spotter-blue font-medium">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
