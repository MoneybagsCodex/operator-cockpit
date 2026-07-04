interface BadgeProps {
  variant: 'success' | 'danger' | 'warning' | 'info';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

export function Badge({ variant, children, size = 'md' }: BadgeProps) {
  const variants = {
    success: 'bg-green-600/20 text-green-400 border border-green-600/30',
    danger: 'bg-red-600/20 text-red-400 border border-red-600/30',
    warning: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30',
    info: 'bg-blue-600/20 text-blue-400 border border-blue-600/30',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <span className={`rounded-full font-medium ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}
