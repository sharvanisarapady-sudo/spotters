import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ImageViewer from '../components/practice/ImageViewer';
import { testService } from '../services/testService';
import { IconCrosshair } from '../components/icons';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TestInterface() {
  const { testId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(location.state?.attempt || null);
  const [questions, setQuestions] = useState(location.state?.questions || []);
  const [loading, setLoading] = useState(!location.state);
  const [error, setError] = useState('');

  const [activeIndex, setActiveIndex] = useState(0); // question currently live/timed
  const [viewIndex, setViewIndex] = useState(0); // question currently displayed
  const [answers, setAnswers] = useState({}); // { [index]: studentAnswer }
  const [inputValue, setInputValue] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const timerRef = useRef(null);
  const submittingRef = useRef(false);

  // Recover attempt state on refresh by starting a fresh attempt
  // (any prior in-progress attempt for this block is auto-abandoned server-side).
  useEffect(() => {
    if (attempt) return;
    let cancelled = false;
    testService
      .start(testId)
      .then((res) => {
        if (cancelled) return;
        setAttempt(res.attempt);
        setQuestions(res.questions);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not start this test.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (attempt) setTimeLeft(attempt.secondsPerQuestion);
  }, [attempt]);

  const totalQuestions = attempt?.totalQuestions || questions.length;
  const isLastQuestion = activeIndex === totalQuestions - 1;
  const isViewingActive = viewIndex === activeIndex;
  const currentQuestion = questions[viewIndex];

  const advance = useCallback(
    async (submittedText) => {
      setAnswers((prev) => ({ ...prev, [activeIndex]: submittedText }));

      if (isLastQuestion) {
        setFinishing(true);
        try {
          await testService.complete(attempt.id);
        } catch {
          // Results page will surface any issue on load.
        }
        navigate(`/tests/attempts/${attempt.id}/results`);
        return;
      }

      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      setViewIndex(nextIndex);
      setInputValue('');
      setTimeLeft(attempt.secondsPerQuestion);
      submittingRef.current = false;
    },
    [activeIndex, isLastQuestion, attempt, navigate]
  );

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || finishing || !isViewingActive) return;
    submittingRef.current = true;
    setSubmitting(true);
    clearInterval(timerRef.current);

    const timeTaken = attempt.secondsPerQuestion - timeLeft;
    try {
      await testService.submitAnswer(attempt.id, {
        questionId: currentQuestion.test_question_id,
        studentAnswer: inputValue,
        timeTakenSeconds: timeTaken,
      });
    } catch {
      // Answer save failures don't block progression; the block-level
      // result will simply show fewer graded questions.
    }
    await advance(inputValue);
    setSubmitting(false);
  }, [finishing, isViewingActive, attempt, timeLeft, currentQuestion, inputValue, advance]);

  // Timer countdown — only runs for the live question.
  useEffect(() => {
    if (!attempt || !isViewingActive || finishing) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isViewingActive, attempt, finishing]);

  const goToPrevious = () => {
    if (viewIndex > 0) setViewIndex(viewIndex - 1);
  };
  const goToNext = () => {
    if (viewIndex < activeIndex) setViewIndex(viewIndex + 1);
  };
  const returnToActive = () => setViewIndex(activeIndex);

  const urgencyClass = timeLeft <= 10 ? 'text-red-400' : 'text-white';

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <p className="text-white/50 text-sm">Preparing your test…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-white/70">{error}</p>
        <button
          onClick={() => navigate('/tests')}
          className="rounded-lg bg-spotter-blue px-5 py-2.5 text-white text-sm font-medium"
        >
          Back to Tests
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <p className="text-white/50 text-sm">Loading question…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-16 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <IconCrosshair className="w-4 h-4 text-spotter-blue-light" />
          <span className="font-display font-semibold text-sm tracking-tight">SPOTTERS.COM</span>
        </div>
        <div className="text-sm text-white/60 font-mono">
          Block {attempt.blockNumber} &middot; Question {viewIndex + 1} / {totalQuestions}
        </div>
        <div className={`font-mono text-lg font-semibold ${isViewingActive ? urgencyClass : 'text-white/30'}`}>
          {isViewingActive ? formatTime(timeLeft) : '—:—'}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <ImageViewer images={currentQuestion.images} />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-navy-900 p-5">
            <p className="font-mono text-[11px] uppercase tracking-wide text-white/40">Case</p>
            <p className="mt-2 text-sm text-white/80 leading-relaxed">
              {currentQuestion.clinical_info || currentQuestion.question_text || 'Case information will appear here.'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-navy-900 p-5 flex-1 flex flex-col">
            <p className="font-mono text-[11px] uppercase tracking-wide text-white/40">
              Identify the most likely diagnosis
            </p>

            {isViewingActive ? (
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={submitting || finishing}
                placeholder="Type your answer here..."
                rows={4}
                className="mt-3 w-full resize-none rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-spotter-blue placeholder:text-white/30"
              />
            ) : (
              <div className="mt-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/60 min-h-[6.5rem]">
                {answers[viewIndex] || <span className="text-white/30">No answer submitted.</span>}
              </div>
            )}

            <div className="mt-auto pt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevious}
                  disabled={viewIndex === 0}
                  className="text-sm text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition px-2 py-1"
                >
                  Previous
                </button>
                <button
                  onClick={goToNext}
                  disabled={viewIndex >= activeIndex}
                  className="text-sm text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition px-2 py-1"
                >
                  Next
                </button>
              </div>

              {isViewingActive ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || finishing}
                  className="rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
                >
                  {finishing ? 'Finishing…' : submitting ? 'Saving…' : isLastQuestion ? 'Finish Test' : 'Submit Answer'}
                </button>
              ) : (
                <button
                  onClick={returnToActive}
                  className="rounded-lg border border-white/20 text-white text-sm font-medium px-5 py-2.5 hover:bg-white/5 transition"
                >
                  Return to Current Question
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
