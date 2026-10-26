import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import StatCard from '../components/dashboard/StatCard';
import SystemCard from '../components/dashboard/SystemCard';
import { dashboardService } from '../services/dashboardService';
import { systemService } from '../services/systemService';
import { IconTimer, IconLayers, IconChart, IconTrophy, IconBookmark } from '../components/icons';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentTests, setRecentTests] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.all([dashboardService.get(), systemService.list()])
      .then(([dash, sys]) => {
        if (cancelled) return;
        setStats(dash.stats);
        setRecentTests(dash.recentTests);
        setSystems(sys.systems);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your dashboard right now. Please refresh.');
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
        <h1 className="font-display font-semibold text-2xl text-navy-950">Welcome back, {user?.full_name}!</h1>
        <p className="mt-1 text-gray-500">Continue learning and improve your diagnostic skills.</p>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading your dashboard…</div>
        ) : (
          <>
            {/* Statistics */}
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={IconTimer} label="Tests Completed" value={stats.testsCompleted} />
              <StatCard icon={IconLayers} label="Questions Attempted" value={stats.questionsAttempted} />
              <StatCard
                icon={IconChart}
                label="Overall Accuracy"
                value={stats.overallAccuracy !== null ? `${stats.overallAccuracy}%` : '—'}
              />
              <StatCard
                icon={IconTrophy}
                label="Best Score"
                value={stats.bestScore ? `${stats.bestScore.score}/${stats.bestScore.total}` : '—'}
              />
              <StatCard icon={IconBookmark} label="Bookmarked Cases" value={stats.bookmarkedCases} />
            </div>

            {/* Continue Learning + Recent Test Performance */}
            <div className="mt-10 grid lg:grid-cols-3 gap-6">
              <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-semibold text-lg text-navy-950">Continue Learning</h2>
                  <Link to="/practice" className="text-sm font-medium text-spotter-blue hover:text-spotter-blue-dark">
                    View all
                  </Link>
                </div>

                {systems.length === 0 ? (
                  <p className="mt-6 text-sm text-gray-400">No cases available yet.</p>
                ) : (
                  <div className="mt-5 grid sm:grid-cols-2 gap-3">
                    {systems.map((s) => (
                      <SystemCard key={s.id} system={s} />
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-semibold text-lg text-navy-950">Recent Test Performance</h2>
                  <Link to="/tests" className="text-sm font-medium text-spotter-blue hover:text-spotter-blue-dark">
                    View all
                  </Link>
                </div>

                {recentTests.length === 0 ? (
                  <p className="mt-6 text-sm text-gray-400">No tests completed yet.</p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {recentTests.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-navy-950">Block {t.block_number}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(t.completed_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="font-mono text-sm text-navy-900">
                          {t.score}/{t.total_questions}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
