import { IconGraduate, IconStethoscope } from '../icons';

export default function UserTypes() {
  return (
    <section id="who-its-for" className="bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-spotter-blue">Who it's for</p>
          <h2 className="mt-3 font-display font-semibold text-3xl text-navy-950">
            Built for students, designed for doctors
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 p-8">
            <div className="w-11 h-11 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue">
              <IconGraduate className="w-[22px] h-[22px]" />
            </div>
            <h3 className="mt-5 font-display font-semibold text-xl text-navy-950">Students</h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Practice by system, sit timed test blocks, track your accuracy, and get AI-guided
              feedback on every case you attempt. Available now.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 p-8 relative">
            <span className="absolute top-6 right-6 text-[11px] font-mono uppercase tracking-wide text-gray-400 border border-gray-200 rounded-full px-2.5 py-1">
              Coming soon
            </span>
            <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
              <IconStethoscope className="w-[22px] h-[22px]" />
            </div>
            <h3 className="mt-5 font-display font-semibold text-xl text-navy-950">Doctors / Radiologists</h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              A dedicated contributor portal for uploading cases, images, and explanations, with a
              draft → review → publish workflow. The Doctor/Contributor portal is a future feature.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
