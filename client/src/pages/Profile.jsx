import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import { IconGraduate, IconStethoscope, IconCheck } from '../components/icons';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    institution: '',
    specialization: '',
    phone: '',
    location: '',
    daily_goal: 10,
    bio: '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || user.fullName || '',
        institution: user.institution || '',
        specialization: user.specialization || '',
        phone: user.phone || '',
        location: user.location || '',
        daily_goal: user.daily_goal || 10,
        bio: user.bio || '',
      });
    }
  }, [user]);

  const isAdmin = user?.role === 'admin';
  const initials = (user?.full_name || user?.fullName || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateProfile(form);
      setNotice('Your profile information has been updated.');
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-semibold text-2xl text-navy-950">Personal &amp; Professional Profile</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your personal details, academic/clinical affiliation, and daily study preferences.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setNotice('');
              setError('');
              setEditing((v) => !v);
            }}
            className="rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark text-white text-sm font-medium px-4 py-2.5 transition"
          >
            {editing ? 'Cancel Editing' : '✎ Update Profile'}
          </button>
        </div>

        {notice && (
          <div className="mt-5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 flex items-center gap-2">
            <IconCheck className="w-4 h-4 shrink-0" />
            {notice}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* Top Identity Banner */}
        <section className="mt-6 rounded-2xl bg-navy-950 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-spotter-blue flex items-center justify-center font-display font-bold text-2xl text-white shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display font-semibold text-xl">
                  {user?.full_name || user?.fullName}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
                    isAdmin
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                      : 'bg-spotter-blue/20 text-spotter-blue-light border border-spotter-blue/30'
                  }`}
                >
                  {isAdmin ? (
                    <>
                      <IconStethoscope className="w-3.5 h-3.5" />
                      Professional Radiologist (Admin)
                    </>
                  ) : (
                    <>
                      <IconGraduate className="w-3.5 h-3.5" />
                      Student Learner
                    </>
                  )}
                </span>
              </div>
              <p className="mt-1 text-sm text-white/60">{user?.email}</p>
              <p className="mt-1 text-xs text-white/40">
                {user?.specialization || (isAdmin ? 'Lead Radiologist & Content Curator' : 'Radiology Education & Spotter Trainee')}
                {user?.institution ? ` · ${user.institution}` : ''}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 border-white/10 pt-4 sm:pt-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-white/40">Member Since</p>
            <p className="mt-1 text-sm font-medium text-white">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Active Member'}
            </p>
            <span className="mt-2 inline-block rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-medium px-2.5 py-0.5">
              ● Account Active
            </span>
          </div>
        </section>

        {/* View vs Edit Mode */}
        {!editing ? (
          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
              <h3 className="font-display font-semibold text-base text-navy-950 border-b border-gray-100 pb-3">
                Personal &amp; Contact Information
              </h3>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Full Name</p>
                <p className="mt-1 text-sm font-medium text-navy-950">{user?.full_name || user?.fullName || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Email Address</p>
                <p className="mt-1 text-sm font-medium text-navy-950">{user?.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Phone / Contact</p>
                <p className="mt-1 text-sm font-medium text-navy-950">{user?.phone || 'Not specified — click Update Profile to add'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Location / City</p>
                <p className="mt-1 text-sm font-medium text-navy-950">{user?.location || 'Not specified — click Update Profile to add'}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
              <h3 className="font-display font-semibold text-base text-navy-950 border-b border-gray-100 pb-3">
                Academic &amp; Clinical Details
              </h3>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Account Role &amp; Rights</p>
                <p className="mt-1 text-sm font-medium text-navy-950">
                  {isAdmin
                    ? 'Admin / Professional Radiologist (Full Case, Answer Key, Video & Block Management)'
                    : 'Student Account (Practice Library, Timed Spotter Tests, Revision & Navigation AI)'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Institution / Hospital / College</p>
                <p className="mt-1 text-sm font-medium text-navy-950">{user?.institution || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Specialization / Academic Year</p>
                <p className="mt-1 text-sm font-medium text-navy-950">{user?.specialization || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Daily Study Goal</p>
                <p className="mt-1 text-sm font-medium text-navy-950">{user?.daily_goal || 10} radiology cases / day</p>
              </div>
            </section>

            <section className="md:col-span-2 rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="font-display font-semibold text-base text-navy-950 border-b border-gray-100 pb-3">
                Bio &amp; Clinical Interests
              </h3>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {user?.bio || 'No bio or clinical interests added yet. Click "Update Profile" above to personalize your radiology profile.'}
              </p>
            </section>
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <h3 className="font-display font-semibold text-lg text-navy-950 border-b border-gray-100 pb-3">
              Edit Your Profile Information
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-navy-950">
                Full Name *
                <input
                  type="text"
                  name="full_name"
                  required
                  value={form.full_name}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Dr. Jane Doe"
                />
              </label>

              <label className="block text-sm font-medium text-navy-950">
                Institution / Hospital / Medical College
                <input
                  type="text"
                  name="institution"
                  value={form.institution}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. AIIMS / Apollo Hospital / Medical College"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-navy-950">
                Specialization / Academic Level
                <input
                  type="text"
                  name="specialization"
                  value={form.specialization}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. MD Radiology Resident · Year 2 / Consultant Radiologist"
                />
              </label>

              <label className="block text-sm font-medium text-navy-950">
                Daily Case Goal (cases per day)
                <input
                  type="number"
                  name="daily_goal"
                  min={1}
                  max={100}
                  value={form.daily_goal}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-navy-950">
                Phone / Contact Number
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="+91 98765 43210"
                />
              </label>

              <label className="block text-sm font-medium text-navy-950">
                Location / City
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. Bengaluru, India"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-navy-950">
              Bio &amp; Clinical Interests
              <textarea
                name="bio"
                rows={3}
                value={form.bio}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Share your radiology focus areas, clinical interests, or exam preparation goals..."
              />
            </label>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark text-white text-sm font-semibold px-5 py-2.5 transition disabled:opacity-50"
              >
                {saving ? 'Saving Changes…' : 'Save Profile Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </main>
    </DashboardLayout>
  );
}
