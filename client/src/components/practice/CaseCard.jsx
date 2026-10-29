import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconCrosshair } from '../icons';
import BookmarkButton from './BookmarkButton';

const difficultyStyles = {
  easy: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  hard: 'bg-red-50 text-red-700 border-red-200',
};

export default function CaseCard({ caseItem, systemSlug }) {
  const [retryCount, setRetryCount] = useState(0);
  const [thumbFailed, setThumbFailed] = useState(false);

  const thumbSrc =
    caseItem.thumbnail_url && retryCount > 0
      ? `${caseItem.thumbnail_url}${caseItem.thumbnail_url.includes('?') ? '&' : '?'}retry=${retryCount}`
      : caseItem.thumbnail_url;

  const handleThumbError = () => {
    if (retryCount < 1) {
      setTimeout(() => setRetryCount(1), 900);
    } else {
      setThumbFailed(true);
    }
  };

  return (
    <Link
      to={`/practice/${systemSlug}/${caseItem.id}`}
      className="group rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-spotter-blue/40 hover:shadow-lg hover:shadow-spotter-blue/5 transition"
    >
      <div className="relative aspect-video bg-navy-950 flex items-center justify-center">
        {thumbSrc && !thumbFailed ? (
          <img
            key={retryCount}
            src={thumbSrc}
            alt=""
            loading="lazy"
            decoding="async"
            onError={handleThumbError}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/20">
            <IconCrosshair className="w-8 h-8" />
            <span className="font-mono text-[10px] tracking-widest uppercase">Radiology Image</span>
          </div>
        )}
        <div className="absolute top-2.5 right-2.5">
          <BookmarkButton caseId={caseItem.id} initialBookmarked={!!caseItem.is_bookmarked} size="sm" />
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-medium text-navy-950 text-sm truncate">{caseItem.title}</h3>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {caseItem.modality && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-gray-200 text-gray-500">
              {caseItem.modality}
            </span>
          )}
          {caseItem.difficulty && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded border capitalize ${
                difficultyStyles[caseItem.difficulty] || 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              {caseItem.difficulty}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
