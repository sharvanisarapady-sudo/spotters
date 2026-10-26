import { Link } from 'react-router-dom';
import { IconCrosshair } from '../icons';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-navy-950/80 border-b border-white/10">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-white">
          <IconCrosshair className="w-5 h-5 text-spotter-blue-light" />
          <span className="font-display font-semibold tracking-tight">SPOTTERS.COM</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <a href="#how-it-works" className="hover:text-white transition">How it works</a>
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#who-its-for" className="hover:text-white transition">Who it's for</a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-white/70 hover:text-white transition px-3 py-2"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="text-sm font-medium bg-spotter-blue hover:bg-spotter-blue-dark text-white rounded-lg px-4 py-2 transition"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
