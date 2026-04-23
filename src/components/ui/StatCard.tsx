interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: 'amber' | 'green' | 'red' | 'blue' | 'slate';
  trend?: 'up' | 'down' | 'neutral';
}

const accentClasses = {
  amber: 'bg-amber-50 border-amber-200 text-amber-600',
  green: 'bg-green-50 border-green-200 text-green-600',
  red: 'bg-red-50 border-red-200 text-red-600',
  blue: 'bg-sky-50 border-sky-200 text-sky-600',
  slate: 'bg-slate-50 border-slate-200 text-slate-600',
};

export default function StatCard({ label, value, sub, icon, accent = 'slate' }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${accentClasses[accent]}`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium opacity-80">{label}</p>
        {icon && <span className="opacity-70">{icon}</span>}
      </div>
      <p className="text-3xl font-bold mt-2 text-slate-900">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}
