import { Link } from 'react-router-dom';
import { IconGraduate, IconStethoscope, IconArrowRight } from '../icons';

export default function UserTypes() {
  return (
    <section id="who-its-for" className="bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-spotter-blue">Who it&apos;s for</p>
          <h2 className="mt-3 font-display font-semibold text-3xl text-navy-950">
            Built for students, designed for doctors
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 p-8 flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue">
                <IconGraduate className="w-[22px] h-[22px]" />
              </div>
              <h3 className="mt-5 font-display font-semibold text-xl text-navy-950">Students</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Practice by system, sit timed test blocks, track your accuracy, plan your daily
                lesson schedule, and get AI-guided feedback on every case you attempt.
              </p>
            </div>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-spotter-blue hover:text-spotter-blue-dark transition"
            >
              Student Portal Login
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="rounded-2xl border border-gray-200 p-8 flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue">
                <IconStethoscope className="w-[22px] h-[22px]" />
              </div>
              <h3 className="mt-5 font-display font-semibold text-xl text-navy-950">Doctors / Radiologists</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Dedicated professional radiologist &amp; admin portal for creating radiology cases,
                uploading multi-slice MRI/X-Ray datasets, attaching video explanations, and managing
                timed spotter test blocks.
              </p>
            </div>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-spotter-blue hover:text-spotter-blue-dark transition"
            >
              Radiologist / Admin Login
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
