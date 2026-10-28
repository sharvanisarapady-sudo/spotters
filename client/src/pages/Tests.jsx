import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { testService } from '../services/testService';
import { progressService } from '../services/progressService';
import { IconTimer } from '../components/icons';

export default function Tests() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingId, setStartingId] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([testService.listBlocks(), progressService.getWrongAnswers()])
      .then(([blocksRes, wrongRes]) => {
        if (cancelled) return;
        setBlocks(blocksRes.blocks);
        setWrongCount(wrongRes.cases?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load test blocks right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = async (block) => {
    setStartingId(block.id);
    setError('');
    try {
      const res = await testService.start(block.id);
      navigate(`/tests/${block.id}/take`, { state: { attempt: res.attempt, questions: res.questions } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start this test.');
      setStartingId(null);
    }
  };

  return (
    <DashboardLayout>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-semibold text-2xl text-navy-950">Tests</h1>
            <p className="mt-1 text-gray-500">Challenge yourself with timed spotter assessments.</p>
          </div>
          {isAdmin && (
            <Link
              to="/admin/cases"
              className="rounded-lg border border-spotter-blue/30 bg-spotter-blue/5 hover:bg-spotter-blue/10 text-spotter-blue text-sm font-medium px-4 py-2 transition"
            >
              + Manage Questions &amp; Blocks
            </Link>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading test blocks…</div>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {blocks.map((block) => {
              const qCount = Number(block.question_count) || 0;
              return (
                <div key={block.id} className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col justify-between">
                  <div>
                    <div className="w-9 h-9 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue">
                      <IconTimer className="w-4 h-4" />
                    </div>
                    <h2 className="mt-4 font-display font-semibold text-lg text-navy-950">
                      Block {block.block_number}
                    </h2>
                    <ul className="mt-3 space-y-1 text-sm text-gray-500">
                      <li>{qCount} {qCount === 1 ? 'Question' : 'Questions'}</li>
                      <li>{qCount > 0 ? `${Math.max(1, Math.round((qCount * block.seconds_per_question) / 60))} Minutes` : '0 Minutes'}</li>
                      <li>{block.seconds_per_question} Seconds / Question</li>
                    </ul>
                  </div>

                  {block.is_ready ? (
                    <button
                      onClick={() => handleStart(block)}
                      disabled={startingId === block.id}
                      className="mt-5 w-full rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark text-white text-sm font-medium py-2.5 transition disabled:opacity-60"
                    >
                      {startingId === block.id ? 'Starting…' : 'Start Test'}
                    </button>
                  ) : (
                    <div className="mt-5">
                      {isAdmin ? (
                        <Link
                          to="/admin/cases"
                          className="block w-full rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium py-2.5 text-center transition"
                        >
                          Empty — Add Questions
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="w-full rounded-lg bg-gray-100 text-gray-400 text-sm font-medium py-2.5 cursor-not-allowed"
                        >
                          Empty Block
                        </button>
                      )}
                      <p className="mt-2 text-xs text-gray-400 text-center">No questions assigned to this block yet.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Revise Block card — appears once the user has any wrong answers */}
        {!loading && wrongCount > 0 && (
          <div className="mt-8">
            <h2 className="font-display font-semibold text-lg text-navy-950">Revision</h2>
            <p className="mt-1 text-sm text-gray-500">Review the cases you've answered incorrectly.</p>
            <div className="mt-4 max-w-sm">
              <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-2xl">
                  📖
                </div>
                <h3 className="mt-4 font-display font-semibold text-lg text-navy-950">Revise Block</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {wrongCount} missed question{wrongCount > 1 ? 's' : ''} across all your attempts.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-gray-500">
                  <li>Self-paced — no timer</li>
                  <li>Reveal correct answers at your own pace</li>
                  <li>Updates after every test</li>
                </ul>
                <Link
                  to="/revise"
                  className="mt-5 block w-full rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2.5 transition text-center"
                >
                  Start Revising
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
