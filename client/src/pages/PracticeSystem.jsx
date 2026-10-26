import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import CaseCard from '../components/practice/CaseCard';
import { practiceService } from '../services/practiceService';
import { IconBack, IconLayers } from '../components/icons';

export default function PracticeSystem() {
  const { slug } = useParams();
  const [system, setSystem] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    practiceService
      .getCasesBySystem(slug)
      .then((res) => {
        if (cancelled) return;
        setSystem(res.system);
        setCases(res.cases);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err.response?.status === 404
              ? 'This radiology system was not found.'
              : 'Could not load cases right now.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <Link to="/practice" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy-950 transition">
          <IconBack className="w-4 h-4" />
          All systems
        </Link>

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading cases…</div>
        ) : error ? (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        ) : (
          <>
            <h1 className="mt-4 font-display font-semibold text-2xl text-navy-950">{system.name}</h1>
            <p className="mt-1 text-gray-500">
              {cases.length > 0
                ? `${cases.length} case${cases.length === 1 ? '' : 's'} available`
                : 'Cases for this system will be added soon.'}
            </p>

            {cases.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                <IconLayers className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="mt-4 text-gray-500 font-medium">No cases available yet.</p>
                <p className="mt-1 text-sm text-gray-400">Cases for this system will be added soon.</p>
              </div>
            ) : (
              <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {cases.map((c) => (
                  <CaseCard key={c.id} caseItem={c} systemSlug={slug} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
