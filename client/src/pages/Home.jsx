import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import HowItWorks from '../components/landing/HowItWorks';
import Features from '../components/landing/Features';
import WhySpotters from '../components/landing/WhySpotters';
import UserTypes from '../components/landing/UserTypes';
import Footer from '../components/landing/Footer';

/**
 * Public landing page (Phase 2).
 * Composed of independent sections so each part of the spec
 * (hero, workflow, features, positioning, audiences, CTA/footer)
 * stays easy to review and adjust on its own.
 */
export default function Home() {
  return (
    <div className="font-sans">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <WhySpotters />
      <UserTypes />
      <Footer />
    </div>
  );
}
