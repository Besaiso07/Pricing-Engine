import clsx from 'clsx'

export default function Badge({ children, className = '' }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', className)}>
      {children}
    </span>
  )
}
