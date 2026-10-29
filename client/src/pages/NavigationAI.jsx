import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Disclaimer from '../components/Disclaimer';
import { navigationAiService } from '../services/navigationAiService';
import { IconCrosshair, IconMic, IconSpark } from '../components/icons';

function AiCaseThumb({ thumbnailUrl }) {
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);

  if (!thumbnailUrl || failed) {
    return (
      <div className="flex flex-col items-center gap-2 text-white/20">
        <IconCrosshair className="w-8 h-8" />
        <span className="font-mono text-[10px] tracking-widest uppercase">Radiology Image</span>
      </div>
    );
  }

  const src = retry > 0 ? `${thumbnailUrl}${thumbnailUrl.includes('?') ? '&' : '?'}retry=${retry}` : thumbnailUrl;

  return (
    <img
      key={retry}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        if (retry < 1) {
          setTimeout(() => setRetry(1), 900);
        } else {
          setFailed(true);
        }
      }}
      className="w-full h-full object-cover"
    />
  );
}

export default function NavigationAI() {
  const [cases, setCases] = useState([]);
  const [modelStatus, setModelStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [system, setSystem] = useState('all');

  useEffect(() => {
    let cancelled = false;
    navigationAiService
      .listCases()
      .then((res) => {
        if (cancelled) return;
        setCases(res.cases || []);
        if (res.modelStatus) setModelStatus(res.modelStatus);
      })
      .catch(() => !cancelled && setError('Could not load the case library right now.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const systems = useMemo(() => [...new Map(cases.map((c) => [c.system_slug, c.system_name])).entries()], [cases]);
  const visible = system === 'all' ? cases : cases.filter((c) => c.system_slug === system);

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-semibold text-2xl text-navy-950">AI Case Mentor</h1>
            <p className="mt-1 text-gray-500">
              Inspect the radiology scan, request visual hints, submit your diagnosis by voice or text, and chat with the AI Case Mentor trained on your uploaded cases.
            </p>
          </div>
          {modelStatus?.ready && (
            <div className="inline-flex items-center gap-2 rounded-full bg-spotter-blue/10 border border-spotter-blue/20 px-3.5 py-1.5 text-xs font-medium text-spotter-blue">
              <IconSpark className="w-3.5 h-3.5 shrink-0" />
              <span>
                Trained on {modelStatus.trainedCasesCount} Cases &middot; {modelStatus.trainedImagesCount} Scans (v{modelStatus.modelVersion})
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading cases…</div>
        ) : cases.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <IconCrosshair className="w-8 h-8 mx-auto text-gray-300" />
            <h2 className="mt-4 font-display font-semibold text-navy-950">No cases available yet</h2>
            <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
              Cases appear here once they are published with a diagnosis. Check back soon.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by system">
              {[['all', 'All systems'], ...systems].map(([slug, name]) => (
                <button
                  key={slug}
                  onClick={() => setSystem(slug)}
                  aria-pressed={system === slug}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    system === slug
                      ? 'bg-spotter-blue border-spotter-blue text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-spotter-blue/40'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((c, idx) => (
                <Link
                  key={c.id}
                  to={`/navigation-ai/${c.id}`}
                  className="group rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-spotter-blue/40 hover:shadow-lg hover:shadow-spotter-blue/5 transition"
                >
                  <div className="aspect-video bg-navy-950 flex items-center justify-center">
                    <AiCaseThumb thumbnailUrl={c.thumbnail_url} />
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-navy-950 text-sm truncate">
                      {c.case_number ? `Case ${c.case_number}` : `Case ${idx + 1}`}
                    </h3>
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="px-2 py-0.5 rounded border border-gray-200 text-gray-500">{c.system_name}</span>
                      {c.modality && <span className="font-mono px-2 py-0.5 rounded border border-gray-200 text-gray-500">{c.modality}</span>}
                      {c.difficulty && <span className="px-2 py-0.5 rounded border border-gray-200 text-gray-500 capitalize">{c.difficulty}</span>}
                      <IconMic className="w-3.5 h-3.5 ml-auto text-gray-300" aria-hidden="true" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <Disclaimer className="mt-10" />
      </main>
    </DashboardLayout>
  );
}
