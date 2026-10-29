import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import ImageViewer from '../components/practice/ImageViewer';
import { progressService } from '../services/progressService';
import { IconBack } from '../components/icons';

export default function ReviseBlock() {
  const [cases, setCases] = useState([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    progressService
      .getWrongAnswers()
      .then((res) => setCases(res.cases || []))
      .catch(() => setError('Could not load your missed questions. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  // Reset per-card state whenever the active case changes
  useEffect(() => {
    setRevealed(false);
  }, [index]);

  const current = cases[index] ?? null;
  const total = cases.length;
  const images = current?.images ?? [];

  const goNext = () => setIndex((i) => Math.min(i + 1, total - 1));
  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));

  return (
    <DashboardLayout>
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Back link */}
        <Link
          to="/tests"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy-950 transition"
        >
          <IconBack className="w-4 h-4" />
          Back to Tests
        </Link>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <h1 className="font-display font-semibold text-2xl text-navy-950">Revise Block</h1>
            <p className="mt-1 text-sm text-gray-500">
              Self-paced review — no timer, no submission.
            </p>
          </div>
          {!loading && total > 0 && (
            <span className="font-mono text-sm text-gray-400">
              {index + 1} / {total}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!loading && total > 0 && (
          <div className="mt-4 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="mt-10 text-sm text-gray-400">Loading your missed questions…</div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {!loading && !error && total === 0 && (
          <div className="mt-12 text-center">
            <p className="text-4xl">🎉</p>
            <h2 className="mt-4 font-display font-semibold text-xl text-navy-950">
              Nothing to revise!
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              You haven't answered any questions incorrectly yet.{' '}
              <Link to="/tests" className="text-spotter-blue hover:underline font-medium">
                Take a test
              </Link>{' '}
              and come back here to review any cases you miss.
            </p>
          </div>
        )}

        {!loading && !error && current && (
          <div className="mt-8 space-y-6">
            {/* Image viewer */}
            {images.length > 0 && <ImageViewer images={images} />}

            {/* Case info */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <span className="inline-block rounded-full bg-red-50 text-red-600 text-xs font-semibold px-3 py-1">
                  ✗ Previously incorrect · {current.times_wrong}×
                </span>
                <span className="text-xs text-gray-400">{current.modality}</span>
              </div>

              <h2 className="mt-3 font-display font-semibold text-xl text-navy-950">
                {revealed ? `Case ${index + 1} — ${current.title}` : `Case ${index + 1}`}
              </h2>

              {current.clinical_info && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Clinical Info</p>
                  <p className="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {current.clinical_info}
                  </p>
                </div>
              )}

              {current.question_text && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Question</p>
                  <p className="mt-1 text-sm font-medium text-navy-950">{current.question_text}</p>
                </div>
              )}

              {/* Reveal answer */}
              {!revealed ? (
                <button
                  onClick={() => setRevealed(true)}
                  className="mt-6 w-full rounded-lg border-2 border-dashed border-amber-300 hover:border-amber-400 hover:bg-amber-50 text-amber-700 text-sm font-medium py-3 transition"
                >
                  Reveal Answer
                </button>
              ) : (
                <div className="mt-6 rounded-xl bg-green-50 border border-green-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-green-700 font-semibold">
                    Correct Answer
                  </p>
                  <p className="mt-1 text-sm text-green-900 font-medium">
                    {current.correct_answer || 'Answer key not available for this case.'}
                  </p>
                  {current.explanation && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs uppercase tracking-wide text-green-700 font-semibold">
                        Explanation
                      </p>
                      <p className="mt-1 text-sm text-green-800 leading-relaxed whitespace-pre-line">
                        {current.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={goPrev}
                disabled={index === 0}
                className="flex-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-navy-950 text-sm font-medium py-2.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>

              {index < total - 1 ? (
                <button
                  onClick={goNext}
                  className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 transition"
                >
                  Next →
                </button>
              ) : (
                <Link
                  to="/tests"
                  className="flex-1 rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark text-white text-sm font-semibold py-2.5 transition text-center"
                >
                  Done — Back to Tests
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
