import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-card border border-border rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-border/50 transition-colors text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, message }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-slate-100 mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg text-slate-300 hover:bg-border/50 transition-colors">
            Cancel
          </button>
          <button onClick={() => { onConfirm(); onClose() }} className="px-4 py-2 text-sm bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
