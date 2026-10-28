import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import StatCard from '../components/dashboard/StatCard';
import SystemCard from '../components/dashboard/SystemCard';
import CaseCard from '../components/practice/CaseCard';
import { progressService } from '../services/progressService';
import { bookmarkService } from '../services/practiceService';
import { systemService } from '../services/systemService';
import { IconTimer, IconLayers, IconChart, IconTrophy, IconBookmark, IconCheck } from '../components/icons';

function AccuracyDonutChart({ correct = 0, attempted = 0 }) {
  const incorrect = Math.max(0, attempted - correct);
  const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const correctDash = attempted > 0 ? (correct / attempted) * circumference : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col justify-between">
      <div>
        <h2 className="font-display font-semibold text-lg text-navy-950">Diagnostic Accuracy Breakdown</h2>
        <p className="mt-1 text-xs text-gray-400">Proportion of questions answered properly vs. incorrect.</p>
      </div>

      <div className="my-6 flex items-center justify-center gap-8">
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={attempted > 0 ? '#FEE2E2' : '#F3F4F6'}
              strokeWidth="14"
            />
            {attempted > 0 && (
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke="#10B981"
                strokeWidth="14"
                strokeDasharray={`${correctDash} ${circumference}`}
                strokeLinecap="round"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display font-bold text-2xl text-navy-950">
              {attempted > 0 ? `${pct}%` : '—'}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">Accuracy</span>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <p className="font-semibold text-navy-950">{correct} Answered Properly</p>
              <p className="text-gray-400">Graded correct</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-red-300 shrink-0" />
            <div>
              <p className="font-semibold text-navy-950">{incorrect} Incorrect</p>
              <p className="text-gray-400">Needs revision</p>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="font-mono text-gray-500">Total Attempted: {attempted}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SevenDayActivityChart({ series = [] }) {
  const maxVal = Math.max(5, ...series.map((d) => d.attempted || 0));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-semibold text-lg text-navy-950">7-Day Question Activity Graph</h2>
          <p className="mt-1 text-xs text-gray-400">Daily questions attempted vs. answered properly over the last 7 days.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-spotter-blue inline-block" /> Attempted
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Correct
          </span>
        </div>
      </div>

      <div className="mt-6 h-40 flex items-end justify-between gap-3 pt-4 border-b border-gray-100">
        {series.map((d) => {
          const attH = Math.round(((d.attempted || 0) / maxVal) * 110);
          const corH = Math.round(((d.correct || 0) / maxVal) * 110);
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end justify-center gap-1 h-28">
                <div
                  title={`${d.attempted} attempted on ${d.date}`}
                  className="w-3 sm:w-4 rounded-t bg-spotter-blue transition-all"
                  style={{ height: `${Math.max(attH, d.attempted > 0 ? 8 : 3)}px`, opacity: d.attempted > 0 ? 1 : 0.2 }}
                />
                <div
                  title={`${d.correct} correct on ${d.date}`}
                  className="w-3 sm:w-4 rounded-t bg-emerald-500 transition-all"
                  style={{ height: `${Math.max(corH, d.correct > 0 ? 8 : 3)}px`, opacity: d.correct > 0 ? 1 : 0.2 }}
                />
              </div>
              <span className="text-[11px] font-mono text-gray-500 pb-1">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const [wrongCases, setWrongCases] = useState([]);
  const [systemCards, setSystemCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCard, setActiveCard] = useState(null); // 'attempted' | 'correct' | null
  const [openBlockId, setOpenBlockId] = useState(1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      progressService.get(),
      bookmarkService.list(),
      progressService.getWrongAnswers(),
      systemService.list(),
    ])
      .then(([p, b, w, sys]) => {
        if (cancelled) return;
        setData(p);
        setBookmarks(b.bookmarks || b.cases || []);
        setWrongCases(w.cases || []);
        setSystemCards(sys.systems || []);
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
  const attemptedQuestions = data?.attemptedQuestions || [];
  const correctQuestions = attemptedQuestions.filter((q) => q.is_correct === 1);
  const blockProgress = data?.blocks || [];
  const dailySeries = data?.activity?.dailySeries || [];
  const hasActivity = o && o.questionsAttempted > 0;

  const toggleCard = (key) => setActiveCard((prev) => (prev === key ? null : key));

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-display font-semibold text-2xl text-navy-950">Progress &amp; Analytics</h1>
        <p className="mt-1 text-gray-500">
          Complete overview of your tests, charts, block-by-block question breakdown, radiology systems, and saved cases.
        </p>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading your complete progress &amp; charts…</div>
        ) : data ? (
          <>
            {/* 1. Key Stat Cards (Interactive) */}
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard icon={IconTimer} label="Tests Completed" value={o.testsCompleted} />
              <StatCard
                icon={IconLayers}
                label="Questions Attempted"
                value={o.questionsAttempted}
                sub={`${o.correctAnswers} correct · ${o.questionsAttempted - o.correctAnswers} incorrect`}
                onClick={() => toggleCard('attempted')}
                active={activeCard === 'attempted'}
              />
              <StatCard
                icon={IconCheck}
                label="Correct Answers"
                value={o.correctAnswers}
                sub={o.questionsAttempted > 0 ? `Out of ${o.questionsAttempted} attempted` : 'Click to view'}
                onClick={() => toggleCard('correct')}
                active={activeCard === 'correct'}
              />
              <StatCard icon={IconChart} label="Overall Accuracy" value={o.overallAccuracy !== null ? `${o.overallAccuracy}%` : '—'} />
              <StatCard
                icon={IconTrophy}
                label="Best Score"
                value={o.bestScore ? `${o.bestScore.score}/${o.bestScore.total}` : '—'}
                sub={o.averageScore !== null ? `Average ${o.averageScore} per test` : undefined}
              />
              <StatCard icon={IconBookmark} label="Bookmarked Cases" value={o.bookmarkedCases} />
            </div>

            {/* Expandable drawer when clicking "Questions Attempted" or "Correct Answers" */}
            {activeCard && (
              <section className="mt-6 rounded-2xl border border-spotter-blue/30 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display font-semibold text-lg text-navy-950">
                      {activeCard === 'attempted'
                        ? `All Attempted Questions (${attemptedQuestions.length})`
                        : `Questions Answered Properly (${correctQuestions.length})`}
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {activeCard === 'attempted'
                        ? 'Every question you have attempted across all test blocks, with your answer and whether it was answered properly.'
                        : 'All questions you answered correctly across your test attempts.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveCard(null)}
                    className="text-xs font-medium text-gray-500 hover:text-navy-950 px-2.5 py-1 rounded border border-gray-200"
                  >
                    Close ✕
                  </button>
                </div>

                {(activeCard === 'attempted' ? attemptedQuestions : correctQuestions).length === 0 ? (
                  <p className="mt-4 text-sm text-gray-400">
                    {activeCard === 'attempted'
                      ? 'You have not attempted any questions yet.'
                      : 'No questions answered correctly yet — take a test to get started!'}
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-gray-100">
                    {(activeCard === 'attempted' ? attemptedQuestions : correctQuestions).map((q) => {
                      const isRight = q.is_correct === 1;
                      return (
                        <li key={q.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-navy-900">
                                Block {q.block_number}{q.question_order ? ` · Q${q.question_order}` : ''}
                              </span>
                              <span className="font-medium text-navy-950">{q.case_title}</span>
                              {q.modality && <span className="text-xs text-gray-400">({q.modality})</span>}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                              <span className="text-gray-600">
                                Your answer:{' '}
                                <strong className="text-navy-950">{q.student_answer || 'No answer submitted'}</strong>
                              </span>
                              <span className="text-gray-600">
                                Correct answer:{' '}
                                <strong className="text-green-700">{q.correct_answer || '—'}</strong>
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                                isRight ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                              }`}
                            >
                              {isRight ? '✓ Answered Properly' : '✗ Incorrect'}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {/* 2. VISUAL CHARTS & GRAPHS */}
            <section className="mt-10 grid lg:grid-cols-2 gap-6">
              <AccuracyDonutChart correct={o.correctAnswers} attempted={o.questionsAttempted} />
              <SevenDayActivityChart series={dailySeries} />
            </section>

            {/* 3. Block-by-Block Progress Breakdown */}
            <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="font-display font-semibold text-lg text-navy-950">Block-by-Block Progress</h2>
              <p className="mt-1 text-xs text-gray-400">
                Questions attempted and answered properly in each test block. Click a block to view its attempted questions.
              </p>

              <div className="mt-4 space-y-3">
                {blockProgress.map((b) => {
                  const isOpen = openBlockId === b.id;
                  return (
                    <div key={b.id} className="rounded-xl border border-gray-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenBlockId(isOpen ? null : b.id)}
                        className="w-full flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-gray-50/70 hover:bg-gray-100/70 transition text-left"
                      >
                        <div>
                          <span className="font-display font-semibold text-navy-950">Block {b.block_number}</span>
                          <span className="ml-3 text-xs text-gray-500">
                            {b.question_count} {b.question_count === 1 ? 'question' : 'questions'} in block
                          </span>
                        </div>
                        <div className="flex items-center gap-5 text-xs font-mono">
                          <span className="text-navy-950">
                            Attempted: <strong>{b.questions_attempted}</strong>
                          </span>
                          <span className="text-green-700">
                            Correct: <strong>{b.correct_answers}</strong>
                          </span>
                          <span className="text-gray-600">
                            Accuracy: <strong>{b.accuracy !== null ? `${b.accuracy}%` : '—'}</strong>
                          </span>
                          <span className="text-spotter-blue font-sans font-medium">
                            {isOpen ? 'Hide ▲' : 'Details ▼'}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="p-5 bg-white border-t border-gray-100">
                          {b.questions.length === 0 ? (
                            <p className="text-sm text-gray-400">
                              No questions attempted in Block {b.block_number} yet.{' '}
                              {b.question_count > 0 && (
                                <Link to="/tests" className="text-spotter-blue hover:underline font-medium">
                                  Start Block {b.block_number}
                                </Link>
                              )}
                            </p>
                          ) : (
                            <ul className="divide-y divide-gray-100">
                              {b.questions.map((q) => {
                                const isRight = q.is_correct === 1;
                                return (
                                  <li key={q.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                                    <div>
                                      <p className="font-medium text-navy-950">
                                        {q.question_order ? `Q${q.question_order} · ` : ''}
                                        {q.case_title}
                                      </p>
                                      <p className="mt-1 text-xs text-gray-500">
                                        Your answer: <span className="font-medium text-navy-900">{q.student_answer || 'No answer submitted'}</span>
                                        {' · '}
                                        Correct answer: <span className="font-medium text-green-700">{q.correct_answer || '—'}</span>
                                      </p>
                                    </div>
                                    <span
                                      className={`self-start sm:self-center shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        isRight ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                                      }`}
                                    >
                                      {isRight ? '✓ Correct' : '✗ Incorrect'}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 4. System-wise Performance Bars + Test History */}
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

            {/* 5. Continue Learning — All Radiology Systems (Merged from old Dashboard) */}
            {systemCards.length > 0 && (
              <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display font-semibold text-lg text-navy-950">Continue Learning by System</h2>
                    <p className="mt-1 text-xs text-gray-400">Jump directly into any of the 11 radiology systems.</p>
                  </div>
                  <Link to="/practice" className="text-sm font-medium text-spotter-blue hover:text-spotter-blue-dark">
                    View Practice Library →
                  </Link>
                </div>
                <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {systemCards.map((s) => (
                    <SystemCard key={s.id} system={s} />
                  ))}
                </div>
              </section>
            )}

            {/* 6. Missed Questions */}
            <section className="mt-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-semibold text-lg text-navy-950">Missed Questions</h2>
                  <p className="mt-1 text-xs text-gray-400">Cases you have answered incorrectly at least once.</p>
                </div>
                {wrongCases.length > 0 && (
                  <Link
                    to="/revise"
                    className="shrink-0 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 transition"
                  >
                    📖 Revise All
                  </Link>
                )}
              </div>

              {wrongCases.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                  <p className="text-2xl">🎉</p>
                  <p className="mt-3 text-sm text-gray-500">No missed questions yet — keep it up!</p>
                  <p className="text-xs text-gray-400">Complete a test to see which cases need revision.</p>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  {wrongCases.map((c) => (
                    <li key={c.case_id} className="flex items-center justify-between px-5 py-4 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-navy-950 truncate">{c.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.modality} · missed {c.times_wrong}×</p>
                      </div>
                      <span className="ml-4 shrink-0 inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                        ✗ Incorrect
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 7. Bookmarked Cases */}
            <section className="mt-10">
              <h2 className="font-display font-semibold text-lg text-navy-950">Bookmarked Cases</h2>
              {bookmarks.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                  <IconBookmark className="w-6 h-6 mx-auto text-gray-300" />
                  <p className="mt-3 text-sm text-gray-500">You haven&apos;t bookmarked any cases yet.</p>
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
