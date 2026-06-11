import clsx from 'clsx'

export default function Input({ label, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-slate-400 font-medium">{label}</label>}
      <input
        className={clsx(
          'bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-200',
          'placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors',
          className
        )}
        {...props}
      />
    </div>
  )
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-slate-400 font-medium">{label}</label>}
      <select
        className={clsx(
          'bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-200',
          'focus:outline-none focus:border-primary transition-colors',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-slate-400 font-medium">{label}</label>}
      <textarea
        className={clsx(
          'bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-200',
          'placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors resize-none',
          className
        )}
        {...props}
      />
    </div>
  )
}
