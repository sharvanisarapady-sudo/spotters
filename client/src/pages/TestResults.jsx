import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { testService } from '../services/testService';
import { IconCheck, IconBack } from '../components/icons';

export default function TestResults() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retaking, setRetaking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    testService
      .getResults(attemptId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load your results.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const handleRetake = async () => {
    if (!data) return;
    setRetaking(true);
    try {
      const res = await testService.start(data.attempt.testId);
      navigate(`/tests/${data.attempt.testId}/take`, {
        state: { attempt: res.attempt, questions: res.questions },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start a new attempt.');
      setRetaking(false);
    }
  };

  const wrongCount = data?.review?.filter((r) => r.is_correct === 0).length ?? 0;

  return (
    <DashboardLayout>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link to="/tests" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy-950 transition">
          <IconBack className="w-4 h-4" />
          All tests
        </Link>

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading results…</div>
        ) : error ? (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl bg-navy-950 text-white p-8 text-center">
              <p className="font-mono text-xs tracking-[0.2em] uppercase text-spotter-blue-light">
                Block {data.attempt.blockNumber} Complete
              </p>
              <p className="mt-3 font-display font-semibold text-4xl">
                {data.attempt.score} / {data.attempt.total}
              </p>
              <p className="mt-1 text-white/50 text-sm">{data.attempt.accuracy}% Accuracy</p>

              <div className="mt-6 flex items-center justify-center gap-8 text-sm">
                <div>
                  <p className="text-green-400 font-semibold text-lg">
                    {data.review.filter((r) => r.is_correct === 1).length}
                  </p>
                  <p className="text-white/40">Correct</p>
                </div>
                <div>
                  <p className="text-red-400 font-semibold text-lg">
                    {data.review.filter((r) => r.is_correct === 0).length}
                  </p>
                  <p className="text-white/40">Incorrect</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleRetake}
                  disabled={retaking}
                  className="rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark text-white text-sm font-semibold px-6 py-2.5 transition disabled:opacity-60 w-full sm:w-auto"
                >
                  {retaking ? 'Starting…' : '↩ Take Again'}
                </button>
                {wrongCount > 0 && (
                  <Link
                    to="/revise"
                    className="rounded-lg border border-white/20 hover:bg-white/5 text-white text-sm font-medium px-6 py-2.5 transition w-full sm:w-auto text-center"
                  >
                    📖 Revise {wrongCount} Missed Question{wrongCount > 1 ? 's' : ''}
                  </Link>
                )}
              </div>
            </div>

            <h2 className="mt-10 font-display font-semibold text-lg text-navy-950">Question-by-Question Review</h2>

            <div className="mt-4 space-y-4">
              {data.review.map((q, i) => {
                const ungraded = q.is_correct === null;
                const correct = q.is_correct === 1;
                return (
                  <div key={q.id} className="rounded-2xl border border-gray-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-gray-400">QUESTION {i + 1}</p>
                      {ungraded ? (
                        <span className="text-xs text-gray-400 font-medium">Not graded</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            correct ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {correct ? <IconCheck className="w-[14px] h-[14px]" /> : '✗'}
                          {correct ? 'CORRECT' : 'INCORRECT'}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 font-medium text-navy-950">{q.title}</h3>

                    <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">Your answer</p>
                        <p className="mt-1 text-navy-900">{q.student_answer || <span className="text-gray-400">No answer submitted</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">Correct answer</p>
                        <p className="mt-1 text-navy-900">
                          {q.correct_answer || <span className="text-gray-400">Answer key not available for this question</span>}
                        </p>
                      </div>
                    </div>

                    {q.explanation && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs uppercase tracking-wide text-gray-400">Explanation</p>
                        <p className="mt-1 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
