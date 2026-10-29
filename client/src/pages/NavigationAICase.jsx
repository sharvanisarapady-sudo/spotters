import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import ImageViewer from '../components/practice/ImageViewer';
import VideoPlayer from '../components/VideoPlayer';
import Disclaimer from '../components/Disclaimer';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import { navigationAiService } from '../services/navigationAiService';
import { IconBack, IconMic, IconCheck, IconSpark } from '../components/icons';

const VERDICT_STYLE = {
  correct: 'border-green-200 bg-green-50 text-green-900',
  incorrect: 'border-red-200 bg-red-50 text-red-900',
  partial: 'border-amber-300 bg-amber-50 text-amber-950',
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

const FOLLOWUP_CHIPS = [
  'Where on the scan are the key findings?',
  'How do I rule out the differential diagnoses?',
  'What is the key exam pearl for this case?',
];

export default function NavigationAICase() {
  const { caseId } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [answer, setAnswer] = useState('');
  const [inputMethod, setInputMethod] = useState('text');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  // Visual AI Hint state (before submission)
  const [hintText, setHintText] = useState('');
  const [loadingHint, setLoadingHint] = useState(false);

  // Interactive AI Mentor Follow-Up Q&A state (after submission)
  const [followUpInput, setFollowUpInput] = useState('');
  const [askingFollowUp, setAskingFollowUp] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  const speech = useSpeechRecognition({
    onFinalText: (text) => {
      setAnswer((prev) => (prev ? `${prev} ${text}` : text));
      setInputMethod('voice');
    },
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResult(null);
    setHintText('');
    setChatMessages([]);
    navigationAiService
      .getCase(caseId)
      .then((res) => {
        if (cancelled) return;
        setCaseData(res.case);
        if (res.modelStatus) setModelStatus(res.modelStatus);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.status === 404 ? 'This case is not available.' : 'Could not load this case right now.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const requestHint = async () => {
    if (loadingHint || hintText) return;
    setLoadingHint(true);
    try {
      const res = await navigationAiService.getHint(caseId);
      setHintText(res.hint || '');
    } catch {
      setSubmitError('Could not load AI hint right now.');
    } finally {
      setLoadingHint(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting || !answer.trim()) return;
    if (speech.listening) speech.stop();
    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await navigationAiService.analyze(caseId, answer.trim(), inputMethod);
      setResult(res);
    } catch (err) {
      setSubmitError(
        err.response?.data?.message ||
          (err.code === 'ECONNABORTED' ? 'The request took too long. Please try again.' : 'Could not analyze your answer. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const askMentor = async (questionText) => {
    const q = (questionText || followUpInput).trim();
    if (!q || askingFollowUp) return;
    setFollowUpInput('');
    setAskingFollowUp(true);
    setChatMessages((prev) => [...prev, { role: 'student', text: q }]);
    try {
      const res = await navigationAiService.askFollowUp(caseId, q, answer.trim());
      setChatMessages((prev) => [...prev, { role: 'mentor', text: res.reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'mentor', text: 'I could not process that question right now — please try asking again.' },
      ]);
    } finally {
      setAskingFollowUp(false);
    }
  };

  const tryAgain = () => {
    setResult(null);
    setAnswer('');
    setInputMethod('text');
    setChatMessages([]);
  };

  const a = result?.analysis;

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/navigation-ai" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy-950 transition">
            <IconBack className="w-4 h-4" />
            Back to cases
          </Link>
          {modelStatus?.ready && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-spotter-blue/10 border border-spotter-blue/20 px-3 py-1 text-[11px] font-medium text-spotter-blue">
              <IconSpark className="w-3.5 h-3.5" />
              AI Case Mentor v{modelStatus.modelVersion} &middot; Trained on {modelStatus.trainedCasesCount} Cases
            </span>
          )}
        </div>

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
                    <h2 className="font-display font-semibold text-xs tracking-wide uppercase text-navy-950">Clinical Stem &amp; Prompt</h2>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                      {[caseData.clinical_info, caseData.question_text].filter(Boolean).join('\n\n')}
                    </p>
                  </div>
                )}

                <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="ai-answer" className="font-display font-semibold text-xs tracking-wide uppercase text-navy-950">
                      Your Diagnosis
                    </label>
                    {!result && (
                      <button
                        type="button"
                        onClick={requestHint}
                        disabled={loadingHint || !!hintText}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition disabled:opacity-60"
                      >
                        {loadingHint ? 'Inspecting scan…' : hintText ? '✓ AI Hint Shown' : '💡 Get AI Visual Hint'}
                      </button>
                    )}
                  </div>

                  {hintText && !result && (
                    <div className="mt-3 rounded-xl bg-amber-50/80 border border-amber-200 p-3.5 text-xs text-amber-950 leading-relaxed whitespace-pre-line">
                      <p className="font-semibold uppercase tracking-wide text-[10px] text-amber-800 mb-1">
                        AI Case Mentor Visual Clue (Spoiler-Free)
                      </p>
                      {hintText}
                    </div>
                  )}

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
                      placeholder={speech.listening ? 'Listening…' : 'Type your diagnosis or imaging sign'}
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
                    <p className="mt-2 text-xs text-gray-400">Voice input isn&apos;t supported in this browser — type your answer instead.</p>
                  )}
                  {speech.error && <p className="mt-2 text-xs text-amber-700">{speech.error}</p>}
                  {submitError && <p role="alert" className="mt-2 text-xs text-red-600">{submitError}</p>}

                  {!result && (
                    <button
                      type="submit"
                      disabled={submitting || !answer.trim()}
                      className="mt-4 w-full rounded-lg bg-spotter-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-spotter-blue-dark transition disabled:opacity-50"
                    >
                      {submitting ? 'AI Mentor Analyzing Scan & Answer…' : 'Analyze with AI Case Mentor'}
                    </button>
                  )}
                </form>
              </div>
            </div>

            {a && (
              <section className="mt-8" aria-live="polite">
                <div className={`rounded-2xl border p-6 ${VERDICT_STYLE[a.partial ? 'partial' : a.verdict]}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {a.verdict === 'correct' && <IconCheck className="w-5 h-5" />}
                      {a.partial && <span aria-hidden="true" className="text-lg leading-none">◐</span>}
                      <h2 className="font-display font-semibold text-lg">
                        {a.headline || (a.verdict === 'correct' ? 'Correct Diagnosis' : a.partial ? 'Partially Correct' : 'Let’s Review This Scan')}
                      </h2>
                    </div>
                    {a.matchLabel && (
                      <span className="rounded-full bg-white/70 border border-current/15 px-3 py-0.5 text-xs font-medium">
                        {a.matchLabel}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid sm:grid-cols-2 gap-3 rounded-xl bg-white/70 p-3.5 text-sm">
                    {a.studentAnswer && (
                      <div>
                        <span className="block text-[11px] uppercase tracking-wide opacity-70">Your Answer</span>
                        <span className="font-semibold">{a.studentAnswer}</span>
                      </div>
                    )}
                    {a.correctDiagnosis && (
                      <div>
                        <span className="block text-[11px] uppercase tracking-wide opacity-70">Diagnosis</span>
                        <span className="font-semibold">{a.correctDiagnosis}</span>
                      </div>
                    )}
                  </div>

                  {a.reasoning && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
                        AI Case Mentor Walkthrough
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-line">{a.reasoning}</p>
                    </div>
                  )}

                  {a.missedFindings && (
                    <div className="mt-4 rounded-xl bg-white/60 border border-current/10 p-3.5 text-xs leading-relaxed whitespace-pre-line">
                      <span className="font-semibold">Visual Checklist on Scan: </span>
                      {a.missedFindings}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <Block title="Explanation">{a.explanation}</Block>
                  <Block title="Key Imaging Findings">{a.keyFindings}</Block>
                  <Block title="Learning Points">{a.learningPoints}</Block>
                  <Block title="Differential Diagnosis">{a.differentialDiagnosis}</Block>
                </div>

                {/* Interactive Follow-Up Q&A with AI Case Mentor */}
                <div className="mt-6 rounded-2xl border border-spotter-blue/20 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <IconSpark className="w-4 h-4 text-spotter-blue" />
                    <h3 className="font-display font-semibold text-sm text-navy-950">
                      Ask AI Case Mentor a Follow-Up Question
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Ask anything about this scan, its radiological signs, or how to differentiate it from mimics.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {FOLLOWUP_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        disabled={askingFollowUp}
                        onClick={() => askMentor(chip)}
                        className="rounded-full border border-spotter-blue/25 bg-spotter-blue/5 hover:bg-spotter-blue/10 px-3 py-1 text-xs font-medium text-spotter-blue transition disabled:opacity-50"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {chatMessages.length > 0 && (
                    <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1">
                      {chatMessages.map((m, idx) => (
                        <div
                          key={idx}
                          className={`rounded-xl px-4 py-3 text-sm whitespace-pre-line ${
                            m.role === 'student'
                              ? 'bg-navy-950 text-white ml-8'
                              : 'bg-gray-50 border border-gray-200 text-gray-700 mr-4'
                          }`}
                        >
                          <p className="text-[10px] font-mono uppercase tracking-wider opacity-60 mb-1">
                            {m.role === 'student' ? 'You' : 'AI Case Mentor'}
                          </p>
                          {m.text}
                        </div>
                      ))}
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      askMentor(followUpInput);
                    }}
                    className="mt-3 flex gap-2"
                  >
                    <input
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      disabled={askingFollowUp}
                      placeholder="Ask e.g. Why isn't this lymphoma? What sign is shown?"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotter-blue/40"
                    />
                    <button
                      type="submit"
                      disabled={askingFollowUp || !followUpInput.trim()}
                      className="rounded-lg bg-navy-950 hover:bg-navy-900 px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
                    >
                      {askingFollowUp ? 'Thinking…' : 'Ask Mentor'}
                    </button>
                  </form>
                </div>

                <div className="mt-4">
                  <VideoPlayer videos={result.videos} />
                </div>

                {a.notice && (
                  <p
                    className={`mt-4 text-xs border-l-2 pl-3 ${
                      a.fallback
                        ? 'text-amber-800 border-amber-400 bg-amber-50 py-2 pr-3 rounded-r'
                        : 'text-gray-500 border-spotter-blue/40'
                    }`}
                  >
                    <span className="font-medium">
                      {a.fallback
                        ? 'AI unavailable — showing stored case feedback. '
                        : a.mode === 'demo'
                        ? 'Demo mode. '
                        : ''}
                    </span>
                    {a.notice}
                  </p>
                )}

                <button
                  onClick={tryAgain}
                  className="mt-5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-navy-950 hover:border-spotter-blue transition"
                >
                  Try Another Answer on This Case
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
