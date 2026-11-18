import clsx from 'clsx'

export default function Card({ children, className = '', ...props }) {
  return (
    <div className={clsx('bg-card border border-border rounded-2xl shadow-sm shadow-slate-500/10', className)} {...props}>
      {children}
    </div>
  )
}
