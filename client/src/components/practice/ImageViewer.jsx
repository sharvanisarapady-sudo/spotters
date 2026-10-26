import { useEffect, useRef, useState } from 'react';
import { IconCrosshair, IconZoomIn, IconZoomOut, IconReset, IconExpand } from '../icons';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

/**
 * The Practice case image viewer. Architecture supports multiple
 * images per case (via `images`) with thumbnail navigation; when
 * no images exist yet, shows the required "Radiology Image"
 * placeholder instead of inventing any content.
 */
export default function ImageViewer({ images = [] }) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [failed, setFailed] = useState({}); // image ids that could not be loaded

  // New case / new image set: forget previous selection and load failures.
  const imageKey = images.map((i) => i.id).join(',');
  useEffect(() => {
    setActiveIndex(0);
    setZoom(MIN_ZOOM);
    setFailed({});
  }, [imageKey]);

  const hasImages = images.length > 0;
  const activeImage = hasImages ? images[activeIndex] : null;

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  const resetZoom = () => setZoom(MIN_ZOOM);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen API unavailable in this browser — controls remain
      // fully usable without it.
    }
  };

  return (
    <div className="rounded-2xl bg-navy-950 border border-white/10 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <span className="font-mono text-[11px] text-white/40 tracking-wide">
          {hasImages ? `IMAGE ${activeIndex + 1} / ${images.length}` : 'RADIOLOGY IMAGE'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <IconZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <IconZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition"
            title="Reset"
            aria-label="Reset zoom"
          >
            <IconReset className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition"
            title="Fullscreen"
            aria-label="Toggle fullscreen"
          >
            <IconExpand className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Viewer surface */}
      <div
        ref={containerRef}
        className="relative aspect-square md:aspect-[4/3] bg-[#050a1c] overflow-hidden flex items-center justify-center"
      >
        {hasImages ? (
          failed[activeImage.id] ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center text-white/40" role="alert">
              <IconCrosshair className="w-12 h-12" />
              <span className="text-sm">This image could not be loaded.</span>
              <button
                onClick={() => setFailed((f) => ({ ...f, [activeImage.id]: false }))}
                className="text-xs rounded-md border border-white/20 px-3 py-1 text-white/70 hover:text-white hover:border-white/50"
              >
                Retry
              </button>
            </div>
          ) : (
            <img
              src={activeImage.image_url}
              alt="Radiology case"
              onError={() => setFailed((f) => ({ ...f, [activeImage.id]: true }))}
              className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out select-none"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/25">
            <IconCrosshair className="w-12 h-12" />
            <span className="font-mono text-xs tracking-widest uppercase">Radiology Image</span>
          </div>
        )}
      </div>

      {/* Thumbnails (only when there's more than one image) */}
      {images.length > 1 && (
        <div className="flex gap-2 px-4 py-3 border-t border-white/10 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              aria-label={`Show image ${i + 1}`}
              onClick={() => {
                setActiveIndex(i);
                setZoom(MIN_ZOOM);
              }}
              className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition ${
                i === activeIndex ? 'border-spotter-blue' : 'border-white/10 opacity-60 hover:opacity-100'
              }`}
            >
              {failed[img.id] ? (
                <span className="w-full h-full flex items-center justify-center bg-white/5 text-white/30 text-[10px]">N/A</span>
              ) : (
                <img
                  src={img.image_url}
                  alt=""
                  onError={() => setFailed((f) => ({ ...f, [img.id]: true }))}
                  className="w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
