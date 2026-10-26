import { useState } from 'react';
import { IconBookmark } from '../icons';
import { bookmarkService } from '../../services/practiceService';

export default function BookmarkButton({ caseId, initialBookmarked = false, size = 'md' }) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [busy, setBusy] = useState(false);

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);

    const next = !isBookmarked;
    setIsBookmarked(next); // optimistic

    try {
      if (next) {
        await bookmarkService.add(caseId);
      } else {
        await bookmarkService.remove(caseId);
      }
    } catch {
      setIsBookmarked(!next); // revert on failure
    } finally {
      setBusy(false);
    }
  };

  const dimensions = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={isBookmarked}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this case'}
      title={isBookmarked ? 'Remove bookmark' : 'Bookmark this case'}
      className={`${dimensions} shrink-0 rounded-lg flex items-center justify-center border transition ${
        isBookmarked
          ? 'bg-spotter-blue/10 border-spotter-blue/30 text-spotter-blue'
          : 'bg-white border-gray-200 text-gray-400 hover:text-spotter-blue hover:border-spotter-blue/30'
      }`}
    >
      <IconBookmark className={iconSize} fill={isBookmarked ? 'currentColor' : 'none'} />
    </button>
  );
}
