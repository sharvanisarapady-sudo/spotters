import { useEffect, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import SystemCard from '../components/dashboard/SystemCard';
import { systemService } from '../services/systemService';

export default function Practice() {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    systemService
      .list()
      .then((res) => {
        if (!cancelled) setSystems(res.systems);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load radiology systems right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-display font-semibold text-2xl text-navy-950">Practice</h1>
        <p className="mt-1 text-gray-500">Learn radiology cases by system.</p>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading systems…</div>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {systems.map((s) => (
              <SystemCard key={s.id} system={s} />
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
