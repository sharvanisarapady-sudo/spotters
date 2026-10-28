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
  const [, setIsFullscreen] = useState(false);
  const [failed, setFailed] = useState({}); // image ids that could not be loaded

  // New case / new image set: forget previous selection and load failures.
  const imageKey = images.map((i) => i.id).join(',');
  useEffect(() => {
    setActiveIndex(0);
    setZoom(MIN_ZOOM);
    setFailed({});
  }, [imageKey]);

  const hasImages = images.length > 0;
  const count = images.length;

  // Preload only the immediately adjacent next slice so scrolling feels smooth
  // without flooding the browser connection pool with 20 simultaneous downloads.
  useEffect(() => {
    if (count < 2) return;
    const nextImg = images[activeIndex + 1];
    if (nextImg?.image_url) {
      const preload = new Image();
      preload.src = nextImg.image_url;
    }
  }, [activeIndex, count, images]);

  // MRI/CT-style stack scrolling: mouse wheel moves through slices. Needs a native
  // listener (not React's onWheel) so we can stop the page itself from scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || count < 2) return undefined;
    let acc = 0; // trackpads fire many tiny events; one slice per ~50px of scroll
    const onWheel = (e) => {
      if (e.ctrlKey) return; // leave pinch / ctrl+wheel browser zoom alone
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < 50) return;
      const dir = Math.sign(acc);
      acc = 0;
      setActiveIndex((i) => Math.min(count - 1, Math.max(0, i + dir)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [count]);

  const onKeyDown = (e) => {
    const dir = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    if (!dir || count < 2) return;
    e.preventDefault();
    setActiveIndex((i) => Math.min(count - 1, Math.max(0, i + dir)));
  };
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
          {hasImages ? `${count > 1 ? 'SLICE' : 'IMAGE'} ${activeIndex + 1} / ${count}` : 'RADIOLOGY IMAGE'}
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
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={onKeyDown}
        className="relative aspect-square outline-none focus-visible:ring-2 focus-visible:ring-spotter-blue/60 md:aspect-[4/3] bg-[#050a1c] overflow-hidden flex items-center justify-center"
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
              decoding="async"
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

      {/* Slice slider (stack scrolling; same as wheel / arrow keys) */}
      {count > 1 && (
        <div className="px-4 py-2 border-t border-white/10">
          <input
            type="range"
            min={0}
            max={count - 1}
            value={activeIndex}
            onChange={(e) => setActiveIndex(Number(e.target.value))}
            aria-label="Scroll through slices"
            className="w-full accent-spotter-blue"
          />
        </div>
      )}

      {/* Thumbnails / Slice selector (only when there's more than one image) */}
      {images.length > 1 && (
        <div className="flex gap-2 px-4 py-3 border-t border-white/10 overflow-x-auto">
          {images.length <= 6
            ? images.map((img, i) => (
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
                      loading="lazy"
                      decoding="async"
                      onError={() => setFailed((f) => ({ ...f, [img.id]: true }))}
                      className="w-full h-full object-cover"
                    />
                  )}
                </button>
              ))
            : images.map((img, i) => (
                <button
                  key={img.id}
                  aria-label={`Show slice ${i + 1}`}
                  onClick={() => {
                    setActiveIndex(i);
                    setZoom(MIN_ZOOM);
                  }}
                  className={`shrink-0 min-w-[2.25rem] h-8 px-2 rounded-md font-mono text-xs border transition ${
                    i === activeIndex
                      ? 'bg-spotter-blue border-spotter-blue text-white font-semibold'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
        </div>
      )}
    </div>
  );
}
