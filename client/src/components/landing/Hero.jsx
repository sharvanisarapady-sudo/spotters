import { Link } from 'react-router-dom';
import ScanFrame from './ScanFrame';
import { IconArrowRight } from '../icons';

export default function Hero() {
  return (
    <section className="relative bg-navy-950 overflow-hidden">
      {/* subtle background grid, evokes an imaging viewer canvas */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 lg:pt-28 lg:pb-32 grid lg:grid-cols-2 gap-16 items-center">
        <div className="animate-fade-up">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-spotter-blue-light">
            Radiology Education Platform
          </p>
          <h1 className="mt-4 font-display font-semibold text-4xl sm:text-5xl leading-[1.08] text-white">
            Master Radiology Spotters.
          </h1>
          <p className="mt-5 text-lg text-white/60 max-w-lg leading-relaxed">
            Learn from radiology cases, test your diagnostic knowledge, track your progress, and
            receive intelligent feedback with Navigation AI.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 bg-spotter-blue hover:bg-spotter-blue-dark text-white font-medium rounded-lg px-6 py-3 transition"
            >
              Get Started
              <IconArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 text-white font-medium rounded-lg px-6 py-3 transition"
            >
              Login
            </Link>
          </div>

          <p className="mt-8 font-mono text-[11px] text-white/30 tracking-wide">
            11 SYSTEMS · TIMED BLOCK ASSESSMENTS · AI-GUIDED REVIEW
          </p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <ScanFrame />
        </div>
      </div>
    </section>
  );
}
