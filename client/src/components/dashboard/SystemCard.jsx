import { Link } from 'react-router-dom';
import { IconLayers, IconArrowRight } from '../icons';

export default function SystemCard({ system }) {
  const hasCases = system.case_count > 0;

  return (
    <Link
      to={`/practice/${system.slug}`}
      className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3.5 hover:border-spotter-blue/40 hover:shadow-sm transition"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 shrink-0 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue">
          <IconLayers className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy-950 truncate">{system.name}</p>
          <p className="text-xs text-gray-400">
            {hasCases ? `${system.case_count} case${system.case_count === 1 ? '' : 's'}` : 'No cases available yet'}
          </p>
        </div>
      </div>
      <IconArrowRight className="w-4 h-4 text-gray-300 group-hover:text-spotter-blue shrink-0 transition" />
    </Link>
  );
}
