interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercent?: boolean;
  colorClass?: string;
}

export default function ProgressBar({ value, max, label, showPercent = true, colorClass = 'bg-amber-500' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const barColor = pct < 25 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : colorClass;

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-slate-600">{label}</span>}
          {showPercent && <span className="text-xs font-medium text-slate-700">{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
