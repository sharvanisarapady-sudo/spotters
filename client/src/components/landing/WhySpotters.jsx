const pillars = ['Case-based learning', 'Timed assessment', 'Performance analysis', 'AI-assisted diagnostic learning'];

export default function WhySpotters() {
  return (
    <section className="bg-navy-950 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-spotter-blue-light">Why Spotters.com?</p>
        <h2 className="mt-3 font-display font-semibold text-3xl text-white max-w-2xl mx-auto">
          One platform, the whole diagnostic workflow
        </h2>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
          {pillars.map((p, i) => (
            <div key={p} className="flex items-center gap-4 sm:gap-5">
              <div className="rounded-xl border border-white/10 bg-navy-900 px-5 py-4 text-white/80 font-medium text-sm sm:text-base">
                {p}
              </div>
              {i < pillars.length - 1 && (
                <span className="font-mono text-spotter-blue-light text-xl select-none" aria-hidden="true">
                  +
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
