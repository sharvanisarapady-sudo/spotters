import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import StatCard from '../components/dashboard/StatCard';
import CaseCard from '../components/practice/CaseCard';
import { progressService } from '../services/progressService';
import { bookmarkService } from '../services/practiceService';
import { IconTimer, IconLayers, IconChart, IconTrophy, IconBookmark, IconCheck } from '../components/icons';

function SystemBar({ system }) {
  const { name, slug, attempted, correct, accuracy } = system;
  return (
    <li>
      <Link to={`/practice/${slug}`} className="block group">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-navy-950 group-hover:text-spotter-blue transition">{name}</span>
          <span className="font-mono text-xs text-gray-500 shrink-0">
            {accuracy === null ? 'No attempts yet' : `${accuracy}% · ${correct}/${attempted}`}
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden"
          role="progressbar"
          aria-label={`${name} accuracy`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={accuracy === null ? undefined : accuracy}
          aria-valuetext={accuracy === null ? 'No attempts yet' : `${accuracy} percent`}
        >
          {accuracy !== null && (
            <div className="h-full rounded-full bg-spotter-blue" style={{ width: `${Math.max(accuracy, 2)}%` }} />
          )}
        </div>
      </Link>
    </li>
  );
}

export default function Progress() {
  const [data, setData] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([progressService.get(), bookmarkService.list()])
      .then(([p, b]) => {
        if (cancelled) return;
        setData(p);
        setBookmarks(b.bookmarks || b.cases || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your progress right now. Please refresh.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const o = data?.overview;
  const hasActivity = o && o.questionsAttempted > 0;

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-display font-semibold text-2xl text-navy-950">Progress</h1>
        <p className="mt-1 text-gray-500">Your performance across tests, systems and saved cases.</p>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading your progress…</div>
        ) : data ? (
          <>
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard icon={IconTimer} label="Tests Completed" value={o.testsCompleted} />
              <StatCard icon={IconLayers} label="Questions Attempted" value={o.questionsAttempted} />
              <StatCard icon={IconCheck} label="Correct Answers" value={o.correctAnswers} />
              <StatCard icon={IconChart} label="Overall Accuracy" value={o.overallAccuracy !== null ? `${o.overallAccuracy}%` : '—'} />
              <StatCard
                icon={IconTrophy}
                label="Best Score"
                value={o.bestScore ? `${o.bestScore.score}/${o.bestScore.total}` : '—'}
                sub={o.averageScore !== null ? `Average ${o.averageScore} per test` : undefined}
              />
              <StatCard icon={IconBookmark} label="Bookmarked Cases" value={o.bookmarkedCases} />
            </div>

            <div className="mt-10 grid lg:grid-cols-5 gap-6">
              <section className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white p-6">
                <h2 className="font-display font-semibold text-lg text-navy-950">System-wise Performance</h2>
                <p className="mt-1 text-xs text-gray-400">Accuracy on graded test answers, by radiology system.</p>
                {!hasActivity && (
                  <p className="mt-4 text-sm text-gray-500">
                    Complete a test to see how you perform in each system.{' '}
                    <Link to="/tests" className="text-spotter-blue hover:text-spotter-blue-dark font-medium">Go to Tests</Link>
                  </p>
                )}
                <ul className="mt-5 space-y-4">
                  {data.systems.map((s) => (
                    <SystemBar key={s.id} system={s} />
                  ))}
                </ul>
              </section>

              <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6">
                <h2 className="font-display font-semibold text-lg text-navy-950">Test History</h2>
                {data.history.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-400">No tests completed yet.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-gray-100">
                    {data.history.map((t) => (
                      <li key={t.id}>
                        <Link
                          to={`/tests/attempts/${t.id}/results`}
                          className="flex items-center justify-between py-3 text-sm hover:bg-gray-50 -mx-2 px-2 rounded-lg transition"
                        >
                          <div>
                            <p className="font-medium text-navy-950">Block {t.block_number}</p>
                            <p className="text-xs text-gray-400">{new Date(t.completed_at).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-navy-900">{t.score}/{t.total_questions}</p>
                            <p className="text-xs text-gray-400">{t.accuracy}%</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="mt-10">
              <h2 className="font-display font-semibold text-lg text-navy-950">Bookmarked Cases</h2>
              {bookmarks.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                  <IconBookmark className="w-6 h-6 mx-auto text-gray-300" />
                  <p className="mt-3 text-sm text-gray-500">You haven't bookmarked any cases yet.</p>
                  <p className="text-xs text-gray-400">Use the bookmark icon on a case in Practice to save it here.</p>
                </div>
              ) : (
                <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bookmarks.map((c) => (
                    <CaseCard key={c.id} caseItem={{ ...c, is_bookmarked: true }} systemSlug={c.system_slug} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </DashboardLayout>
  );
}
