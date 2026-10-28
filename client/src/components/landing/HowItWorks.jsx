import { IconLayers, IconTimer, IconChart, IconSpark } from '../icons';

const steps = [
  {
    n: '01',
    icon: IconLayers,
    title: 'Practice',
    desc: 'Learn radiology cases by system.',
  },
  {
    n: '02',
    icon: IconTimer,
    title: 'Test',
    desc: 'Challenge yourself with timed spotter assessments.',
  },
  {
    n: '03',
    icon: IconChart,
    title: 'Progress',
    desc: 'Track accuracy, scores, weaknesses and improvement.',
  },
  {
    n: '04',
    icon: IconSpark,
    title: 'AI Case Mentor',
    desc: 'Answer cases by typing or voice and receive intelligent feedback.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-navy-950 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-spotter-blue-light">
            The Workflow
          </p>
          <h2 className="mt-3 font-display font-semibold text-3xl text-white">
            How Spotters.com works
          </h2>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden">
          {steps.map((step, i) => (
            <div key={step.n} className="bg-navy-950 p-7 relative">
              {/* connecting line between steps on large screens */}
              {i < steps.length - 1 && (
                <span
                  className="hidden lg:block absolute top-11 -right-px w-px h-6 bg-spotter-blue/30"
                  aria-hidden="true"
                />
              )}
              <span className="font-mono text-xs text-white/30 border border-white/15 rounded px-1.5 py-0.5">
                {step.n}
              </span>
              <step.icon className="w-6 h-6 text-spotter-blue-light mt-5" />
              <h3 className="mt-4 font-display font-semibold text-white text-lg">{step.title}</h3>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
