import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { testService } from '../services/testService';
import { progressService } from '../services/progressService';
import { IconTimer, IconLayers } from '../components/icons';

function BlockCard({ block, indexLabel, badgeText, badgeColor, startingId, onStart, isAdmin }) {
  const qCount = Number(block.question_count) || 0;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col justify-between hover:border-spotter-blue/40 hover:shadow-md hover:shadow-spotter-blue/5 transition">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="w-9 h-9 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue">
            {block.block_type === 'system' ? <IconLayers className="w-4 h-4" /> : <IconTimer className="w-4 h-4" />}
          </div>
          {badgeText && (
            <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
              {badgeText}
            </span>
          )}
        </div>
        <h3 className="mt-4 font-display font-semibold text-lg text-navy-950">
          {indexLabel || `Block ${block.block_number}`}
        </h3>
        <ul className="mt-3 space-y-1 text-sm text-gray-500">
          <li>{qCount} {qCount === 1 ? 'Question' : 'Questions'}</li>
          <li>{qCount > 0 ? `${Math.max(1, Math.round((qCount * block.seconds_per_question) / 60))} Minutes` : '0 Minutes'}</li>
          <li>{block.seconds_per_question} Seconds / Question</li>
        </ul>
      </div>

      {block.is_ready ? (
        <button
          onClick={() => onStart(block)}
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
          <p className="mt-2 text-xs text-gray-400 text-center">Populates automatically when cases are added.</p>
        </div>
      )}
    </div>
  );
}

export default function Tests() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingId, setStartingId] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [tab, setTab] = useState('all'); // 'all' | 'regular' | 'system'

  useEffect(() => {
    let cancelled = false;
    Promise.all([testService.listBlocks(), progressService.getWrongAnswers()])
      .then(([blocksRes, wrongRes]) => {
        if (cancelled) return;
        setBlocks(blocksRes.blocks || []);
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

  const regularBlocks = blocks.filter((b) => b.block_type !== 'system');
  const systemBlocks = blocks.filter((b) => b.block_type === 'system');

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-semibold text-2xl text-navy-950">Spotter Block Tests</h1>
            <p className="mt-1 text-gray-500">
              Take Regular Mixed Spotter Blocks (Block 1, Block 2, …) or System-Based Spotter Blocks across all 11 Radiology Systems.
            </p>
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

        {/* Filter Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ['all', `All Blocks (${blocks.length})`],
            ['regular', `Regular Blocks (${regularBlocks.length})`],
            ['system', `System-Based Blocks (${systemBlocks.length})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                tab === key
                  ? 'bg-spotter-blue border-spotter-blue text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-spotter-blue/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading test blocks…</div>
        ) : (
          <div className="mt-8 space-y-12">
            {/* 1. REGULAR MIXED BLOCKS */}
            {(tab === 'all' || tab === 'regular') && (
              <section>
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-spotter-blue/10 text-spotter-blue px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider font-semibold">
                      Mixed Systems · Random &amp; Unique
                    </span>
                    <h2 className="font-display font-semibold text-lg text-navy-950">
                      Regular Spotter Blocks (Block 1, Block 2, Block 3, …)
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Each block selects unique cases at random from all published cases and expands to new block numbers automatically as more cases are added.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {regularBlocks.map((block) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      indexLabel={`Block ${block.block_number}`}
                      badgeText="Regular Block"
                      badgeColor="bg-spotter-blue/5 border-spotter-blue/20 text-spotter-blue"
                      startingId={startingId}
                      onStart={handleStart}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 2. SYSTEM-BASED BLOCKS (11 Radiology Systems) */}
            {(tab === 'all' || tab === 'system') && systemBlocks.length > 0 && (
              <section>
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider font-semibold">
                      11 Radiology Systems
                    </span>
                    <h2 className="font-display font-semibold text-lg text-navy-950">
                      System-Based Spotter Blocks (11 Systems)
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Dedicated timed assessment blocks for each of the 11 Radiology Systems. Automatically includes all published cases for that system in random order.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {systemBlocks.map((block, idx) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      indexLabel={block.system_name || block.title}
                      badgeText={`System ${block.system_order || idx + 1} of 11`}
                      badgeColor="bg-emerald-50 border-emerald-200 text-emerald-700"
                      startingId={startingId}
                      onStart={handleStart}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Revise Block card — appears once the user has any wrong answers */}
        {!loading && wrongCount > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h2 className="font-display font-semibold text-lg text-navy-950">Revision</h2>
            <p className="mt-1 text-sm text-gray-500">Review the cases you&apos;ve answered incorrectly.</p>
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
