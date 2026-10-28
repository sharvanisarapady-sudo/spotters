export default function StatCard({ icon: Icon, label, value, sub, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left w-full rounded-2xl border p-5 transition ${
        active
          ? 'border-spotter-blue bg-spotter-blue/5 ring-2 ring-spotter-blue/20'
          : 'border-gray-200 bg-white'
      } ${onClick ? 'cursor-pointer hover:border-spotter-blue/50 hover:shadow-sm' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg bg-spotter-blue/10 flex items-center justify-center text-spotter-blue">
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {onClick && (
          <span className="text-[11px] font-medium text-spotter-blue">
            {active ? 'Hide details ▲' : 'View questions ▼'}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-display font-semibold text-navy-950">{value}</p>
      <p className="mt-0.5 text-sm text-gray-500">{label}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </Tag>
  );
}
