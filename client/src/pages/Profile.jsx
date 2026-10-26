import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';

export default function Profile() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display font-semibold text-2xl text-navy-950">Profile</h1>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Full Name</p>
            <p className="mt-1 text-navy-950 font-medium">{user?.full_name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Email</p>
            <p className="mt-1 text-navy-950 font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Role</p>
            <p className="mt-1 text-navy-950 font-medium capitalize">{user?.role}</p>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
