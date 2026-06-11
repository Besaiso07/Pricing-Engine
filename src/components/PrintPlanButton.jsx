import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText } from 'lucide-react'
import clsx from 'clsx'
import PlanReport from './PlanReport'

// Renders a button that prints a single plan's cost report (Print → Save as PDF).
export default function PrintPlanButton({ planId, label = 'PDF', size = 'sm', className = '', iconOnly = false }) {
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    // small delay so the portal report is in the DOM before the print dialog opens
    const t = setTimeout(() => window.print(), 200)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done) }
  }, [printing])

  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPrinting(true) }}
        title="Export as PDF"
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg font-medium transition-colors',
          'bg-transparent border border-border text-slate-300 hover:bg-border/50',
          sz, className
        )}
      >
        <FileText size={size === 'sm' ? 13 : 15} />
        {!iconOnly && label}
      </button>
      {printing && createPortal(<PlanReport planId={planId} />, document.body)}
    </>
  )
}
