import clsx from 'clsx'

const variants = {
  primary: 'bg-primary text-bg hover:bg-primary/90',
  ghost: 'bg-transparent border border-border text-slate-300 hover:bg-border/50',
  danger: 'bg-danger/20 border border-danger/40 text-danger hover:bg-danger/30',
  success: 'bg-success/20 border border-success/40 text-success hover:bg-success/30',
}

export default function Button({ children, variant = 'ghost', className = '', size = 'md', ...props }) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant], sz, className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
