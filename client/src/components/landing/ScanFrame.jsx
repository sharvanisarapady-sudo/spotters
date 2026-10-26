import { IconCrosshair } from '../icons';

/**
 * The page's signature visual: a mock diagnostic image viewer with
 * corner brackets, a sweeping scan line, and a HUD-style data strip —
 * the actual on-screen "furniture" a student sees when they open a
 * spotter case. This is a decorative marketing mockup only; no real
 * case content, images, or diagnoses are represented here.
 */
export default function ScanFrame() {
  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0">
      {/* ambient glow */}
      <div className="absolute -inset-6 bg-spotter-blue/20 blur-3xl rounded-full" aria-hidden="true" />

      <div className="relative rounded-2xl bg-navy-900 border border-white/10 shadow-2xl overflow-hidden">
        {/* HUD top strip */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 font-mono text-[11px] text-white/40 tracking-wide">
          <span>CASE — 000</span>
          <span className="text-spotter-blue-light">AXIAL · CT</span>
        </div>

        {/* image viewer area */}
        <div className="relative aspect-square bg-[#050a1c]">
          {/* corner brackets */}
          {[
            'top-3 left-3 border-t border-l',
            'top-3 right-3 border-t border-r',
            'bottom-3 left-3 border-b border-l',
            'bottom-3 right-3 border-b border-r',
          ].map((pos) => (
            <span
              key={pos}
              className={`absolute w-5 h-5 border-spotter-blue-light/70 ${pos}`}
              aria-hidden="true"
            />
          ))}

          {/* sweeping scan line */}
          <div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-spotter-blue-light/80 to-transparent animate-scan"
            aria-hidden="true"
          />

          {/* center crosshair + placeholder label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/25">
            <IconCrosshair className="w-10 h-10" />
            <span className="font-mono text-[11px] tracking-widest uppercase">Radiology Image</span>
          </div>
        </div>

        {/* answer bar */}
        <div className="px-4 py-3 border-t border-white/10 bg-navy-950/60">
          <p className="font-mono text-[11px] text-white/35 mb-1.5">Identify the most likely diagnosis</p>
          <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2">
            <span className="text-sm text-white/50">
              Type your diagnosis
              <span className="inline-block w-[2px] h-4 align-middle ml-0.5 bg-spotter-blue-light animate-blink" />
            </span>
            <span className="text-[10px] font-mono text-white/30">60s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
