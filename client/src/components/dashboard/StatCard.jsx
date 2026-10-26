export default function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="w-9 h-9 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue">
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <p className="mt-4 text-2xl font-display font-semibold text-navy-950">{value}</p>
      <p className="mt-0.5 text-sm text-gray-500">{label}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
