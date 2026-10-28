import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import ImageViewer from '../components/practice/ImageViewer';
import VideoPlayer from '../components/VideoPlayer';
import Disclaimer from '../components/Disclaimer';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import { navigationAiService } from '../services/navigationAiService';
import { IconBack, IconMic, IconCheck } from '../components/icons';

const VERDICT_STYLE = {
  correct: 'border-green-200 bg-green-50 text-green-800',
  incorrect: 'border-red-200 bg-red-50 text-red-800',
  partial: 'border-amber-300 bg-amber-50 text-amber-900',
  unavailable: 'border-gray-200 bg-gray-50 text-gray-700',
};

function Block({ title, children }) {
  if (!children) return null;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="font-display font-semibold text-xs tracking-wide uppercase text-navy-950">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  );
}

export default function NavigationAICase() {
  const { caseId } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [answer, setAnswer] = useState('');
  const [inputMethod, setInputMethod] = useState('text');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  const speech = useSpeechRecognition({
    onFinalText: (text) => {
      setAnswer((prev) => (prev ? `${prev} ${text}` : text));
      setInputMethod('voice');
    },
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    navigationAiService
      .getCase(caseId)
      .then((res) => !cancelled && setCaseData(res.case))
      .catch((err) => {
        if (!cancelled) setError(err.response?.status === 404 ? 'This case is not available.' : 'Could not load this case right now.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting || !answer.trim()) return;
    if (speech.listening) speech.stop();
    setSubmitError('');
    setSubmitting(true);
    try {
      setResult(await navigationAiService.analyze(caseId, answer.trim(), inputMethod));
    } catch (err) {
      setSubmitError(
        err.response?.data?.message ||
          (err.code === 'ECONNABORTED' ? 'The request took too long. Please try again.' : 'Could not analyze your answer. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const tryAgain = () => {
    setResult(null);
    setAnswer('');
    setInputMethod('text');
  };

  const a = result?.analysis;

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <Link to="/navigation-ai" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy-950 transition">
          <IconBack className="w-4 h-4" />
          Back to cases
        </Link>

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading case…</div>
        ) : error ? (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
        ) : (
          <>
            <h1 className="mt-4 font-display font-semibold text-2xl text-navy-950">
              {caseData.case_number ? `Case ${caseData.case_number}` : `Case ${caseData.id}`}
            </h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2 py-0.5 rounded border border-gray-200 text-gray-500">{caseData.system_name}</span>
              {caseData.modality && <span className="font-mono px-2 py-0.5 rounded border border-gray-200 text-gray-500">{caseData.modality}</span>}
              {caseData.difficulty && <span className="px-2 py-0.5 rounded border border-gray-200 text-gray-500 capitalize">{caseData.difficulty}</span>}
            </div>

            <div className="mt-8 grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <ImageViewer images={caseData.images} />
              </div>

              <div className="lg:col-span-2 space-y-4">
                {(caseData.clinical_info || caseData.question_text) && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <h2 className="font-display font-semibold text-xs tracking-wide uppercase text-navy-950">Case</h2>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                      {caseData.clinical_info || caseData.question_text}
                    </p>
                  </div>
                )}

                <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <label htmlFor="ai-answer" className="font-display font-semibold text-xs tracking-wide uppercase text-navy-950">
                    Your diagnosis
                  </label>
                  <div className="mt-3 flex gap-2">
                    <input
                      id="ai-answer"
                      value={speech.listening && speech.interim ? `${answer} ${speech.interim}`.trim() : answer}
                      onChange={(e) => {
                        setAnswer(e.target.value);
                        setInputMethod('text');
                      }}
                      maxLength={500}
                      disabled={!!result || submitting}
                      placeholder={speech.listening ? 'Listening…' : 'Type your diagnosis'}
                      className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotter-blue/40 disabled:bg-gray-50"
                    />
                    {speech.supported && (
                      <button
                        type="button"
                        onClick={speech.listening ? speech.stop : speech.start}
                        disabled={!!result || submitting}
                        aria-pressed={speech.listening}
                        aria-label={speech.listening ? 'Stop voice input' : 'Answer by voice'}
                        className={`shrink-0 w-10 rounded-lg border flex items-center justify-center transition disabled:opacity-40 ${
                          speech.listening
                            ? 'bg-red-50 border-red-300 text-red-600 animate-pulse'
                            : 'border-gray-300 text-gray-500 hover:border-spotter-blue hover:text-spotter-blue'
                        }`}
                      >
                        <IconMic className="w-[18px] h-[18px]" />
                      </button>
                    )}
                  </div>

                  {!speech.supported && (
                    <p className="mt-2 text-xs text-gray-400">Voice input isn't supported in this browser — type your answer instead.</p>
                  )}
                  {speech.error && <p className="mt-2 text-xs text-amber-700">{speech.error}</p>}
                  {submitError && <p role="alert" className="mt-2 text-xs text-red-600">{submitError}</p>}

                  {!result && (
                    <button
                      type="submit"
                      disabled={submitting || !answer.trim()}
                      className="mt-4 w-full rounded-lg bg-spotter-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-spotter-blue-dark transition disabled:opacity-50"
                    >
                      {submitting ? 'Analyzing your answer…' : 'Submit answer'}
                    </button>
                  )}
                </form>
              </div>
            </div>

            {a && (
              <section className="mt-8" aria-live="polite">
                <div className={`rounded-2xl border p-5 ${VERDICT_STYLE[a.partial ? 'partial' : a.verdict]}`}>
                  <div className="flex items-center gap-2">
                    {a.verdict === 'correct' && <IconCheck className="w-5 h-5" />}
                    {a.partial && <span aria-hidden="true" className="text-lg leading-none">◐</span>}
                    <h2 className="font-display font-semibold text-lg">{a.verdict === 'correct' ? 'Correct' : a.partial ? 'Partially correct' : a.verdict === 'incorrect' ? 'Incorrect' : 'Not evaluated'}</h2>
                  </div>
                  <p className="mt-1 text-sm">{a.headline !== 'Correct' && a.headline !== 'Incorrect' && !a.partial ? a.headline : null}</p>
                  {a.studentAnswer && <p className="mt-2 text-sm">Your answer: <span className="font-medium">{a.studentAnswer}</span></p>}
                  {a.correctDiagnosis && <p className="mt-1 text-sm">Recorded diagnosis: <span className="font-medium">{a.correctDiagnosis}</span></p>}
                  {a.matchLabel && a.verdict === 'incorrect' && <p className="mt-1 text-xs opacity-80">{a.matchLabel}</p>}
                  {a.reasoning && <p className="mt-3 text-sm whitespace-pre-line">{a.reasoning}</p>}
                </div>

                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <Block title="Explanation">{a.explanation}</Block>
                  <Block title="Key Imaging Findings">{a.keyFindings}</Block>
                  <Block title="Learning Points">{a.learningPoints}</Block>
                  <Block title="Differential Diagnosis">{a.differentialDiagnosis}</Block>
                </div>
                {a.missedFindings && <p className="mt-3 text-sm text-gray-600 whitespace-pre-line">{a.missedFindings}</p>}

                <div className="mt-4">
                  <VideoPlayer videos={result.videos} />
                </div>

                {a.notice && (
                  <p
                    className={`mt-4 text-xs border-l-2 pl-3 ${
                      a.fallback ? 'text-amber-800 border-amber-400 bg-amber-50 py-2 pr-3 rounded-r' : 'text-gray-500 border-gray-200'
                    }`}
                  >
                    <span className="font-medium">
                      {a.fallback ? 'AI unavailable — showing stored case feedback. ' : a.mode === 'demo' ? 'Demo mode. ' : 'AI-generated. '}
                    </span>
                    {a.notice}
                  </p>
                )}

                <button onClick={tryAgain} className="mt-5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-navy-950 hover:border-spotter-blue transition">
                  Try again
                </button>
              </section>
            )}

            <Disclaimer className="mt-10" />
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
