import { Link } from 'react-router-dom';
import { IconCrosshair, IconArrowRight } from '../icons';

export default function Footer() {
  return (
    <>
      <section className="bg-navy-950 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <h2 className="font-display font-semibold text-3xl sm:text-4xl text-white max-w-xl mx-auto">
            Start spotting the diagnosis, not guessing it.
          </h2>
          <p className="mt-4 text-white/50 max-w-md mx-auto">
            Create your free student account and start practicing today.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 bg-spotter-blue hover:bg-spotter-blue-dark text-white font-medium rounded-lg px-6 py-3 transition"
          >
            Get Started
            <IconArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-navy-950 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white/70">
              <IconCrosshair className="w-4 h-4 text-spotter-blue-light" />
              <span className="font-display font-semibold text-sm tracking-tight">SPOTTERS.COM</span>
            </div>
            <p className="text-xs text-white/30">Learn. Identify. Diagnose.</p>
          </div>
          <p className="mt-6 text-xs text-white/25 max-w-xl leading-relaxed">
            Spotters.com is an educational platform and is not intended to replace clinical
            judgment, professional training, or medical advice.
          </p>
        </div>
      </footer>
    </>
  );
}
