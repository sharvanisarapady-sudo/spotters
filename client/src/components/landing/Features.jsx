import {
  IconLayers,
  IconTimer,
  IconChart,
  IconSpark,
  IconMic,
  IconBookOpen,
  IconVideo,
  IconCrosshair,
} from '../icons';

const features = [
  { icon: IconCrosshair, title: 'Case-Based Learning', desc: 'Study real spotter cases organized the way you\u2019ll actually encounter them.' },
  { icon: IconLayers, title: 'System-Wise Practice', desc: 'Work through 11 radiology systems at your own pace.' },
  { icon: IconTimer, title: 'Timed Spotter Tests', desc: '20-question blocks, 60 seconds per question, built like the real exam.' },
  { icon: IconChart, title: 'Performance Tracking', desc: 'See your accuracy, scores, and weak systems at a glance.' },
  { icon: IconSpark, title: 'AI-Powered Feedback', desc: 'AI Case Mentor explains not just what you got wrong, but why.' },
  { icon: IconMic, title: 'Voice-Based Answers', desc: 'Speak your diagnosis instead of typing it, when you want to move faster.' },
  { icon: IconBookOpen, title: 'Detailed Explanations', desc: 'Every case pairs findings with clear, structured teaching points.' },
  { icon: IconVideo, title: 'Video Case Solutions', desc: 'Walk through select cases with a recorded explanation.' },
];

export default function Features() {
  return (
    <section id="features" className="bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-spotter-blue">
            Built for the exam and beyond
          </p>
          <h2 className="mt-3 font-display font-semibold text-3xl text-navy-950">
            Everything you need to learn spotters
          </h2>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-gray-200 bg-white p-6 hover:border-spotter-blue/40 hover:shadow-lg hover:shadow-spotter-blue/5 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue group-hover:bg-spotter-blue group-hover:text-white transition">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-display font-semibold text-navy-950">{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
