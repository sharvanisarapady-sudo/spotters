import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import ImageViewer from '../components/practice/ImageViewer';
import BookmarkButton from '../components/practice/BookmarkButton';
import { practiceService } from '../services/practiceService';
import VideoPlayer from '../components/VideoPlayer';
import Disclaimer from '../components/Disclaimer';
import { IconBack } from '../components/icons';

function Section({ title, content }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="font-display font-semibold text-sm tracking-wide uppercase text-navy-950">{title}</h2>
      {content ? (
        <p className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{content}</p>
      ) : (
        <p className="mt-3 text-sm text-gray-400">
          {title === 'Diagnosis' ? 'Diagnosis will appear after submission.' : 'Case information will appear here.'}
        </p>
      )}
    </div>
  );
}

export default function PracticeCase() {
  const { slug, caseId } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    practiceService
      .getCase(caseId)
      .then((res) => {
        if (!cancelled) setCaseData(res.case);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err.response?.status === 404
              ? 'This case is not available.'
              : 'Could not load this case right now.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <Link
          to={`/practice/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy-950 transition"
        >
          <IconBack className="w-4 h-4" />
          Back to cases
        </Link>

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading case…</div>
        ) : error ? (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display font-semibold text-2xl text-navy-950">{caseData.title}</h1>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono px-2 py-0.5 rounded border border-gray-200 text-gray-500">
                    {caseData.system_name}
                  </span>
                  {caseData.modality && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded border border-gray-200 text-gray-500">
                      {caseData.modality}
                    </span>
                  )}
                  {caseData.difficulty && (
                    <span className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 capitalize">
                      {caseData.difficulty}
                    </span>
                  )}
                </div>
              </div>
              <BookmarkButton caseId={caseData.id} initialBookmarked={!!caseData.is_bookmarked} />
            </div>

            <div className="mt-8 grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <ImageViewer images={caseData.images} />
              </div>

              <div className="lg:col-span-2 space-y-4">
                <Section title="Case" content={caseData.clinical_info || caseData.question_text} />
                <Section title="Diagnosis" content={[caseData.correct_answer, caseData.explanation].filter(Boolean).join('\n\n')} />
              </div>
            </div>

            <div className="mt-6 grid md:grid-cols-3 gap-4">
              <Section title="Key Imaging Findings" content={caseData.key_findings} />
              <Section title="Learning Points" content={caseData.learning_points} />
              <Section title="Differential Diagnosis" content={caseData.differential_diagnosis} />
            </div>

            <div className="mt-6">
              <VideoPlayer videos={caseData.videos} />
            </div>

            <Disclaimer className="mt-10" />
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
