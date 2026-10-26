import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { testService } from '../services/testService';
import { IconTimer } from '../components/icons';

export default function Tests() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    testService
      .listBlocks()
      .then((res) => {
        if (!cancelled) setBlocks(res.blocks);
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
        <h1 className="font-display font-semibold text-2xl text-navy-950">Tests</h1>
        <p className="mt-1 text-gray-500">Challenge yourself with timed spotter assessments.</p>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading test blocks…</div>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {blocks.map((block) => (
              <div key={block.id} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="w-9 h-9 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue">
                  <IconTimer className="w-4 h-4" />
                </div>
                <h2 className="mt-4 font-display font-semibold text-lg text-navy-950">
                  Block {block.block_number}
                </h2>
                <ul className="mt-3 space-y-1 text-sm text-gray-500">
                  <li>{block.total_questions} Questions</li>
                  <li>{Math.round((block.total_questions * block.seconds_per_question) / 60)} Minutes</li>
                  <li>{block.seconds_per_question} Seconds / Question</li>
                </ul>

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
                    <button
                      disabled
                      className="w-full rounded-lg bg-gray-100 text-gray-400 text-sm font-medium py-2.5 cursor-not-allowed"
                    >
                      Coming Soon
                    </button>
                    <p className="mt-2 text-xs text-gray-400 text-center">Questions not available yet.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
