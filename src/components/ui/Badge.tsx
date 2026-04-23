interface BadgeProps {
  label: string;
  variant?: 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'orange' | 'teal' | 'yellow';
}

const variants = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-sky-100 text-sky-800',
  slate: 'bg-slate-100 text-slate-700',
  orange: 'bg-orange-100 text-orange-800',
  teal: 'bg-teal-100 text-teal-800',
  yellow: 'bg-yellow-100 text-yellow-800',
};

export default function Badge({ label, variant = 'slate' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {label}
    </span>
  );
}
