import { useState } from 'react'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { ConfirmModal } from '../components/ui/Modal'
import {
  Plus, Pencil, Trash2, Upload, RotateCcw, History, Search, Eraser,
} from 'lucide-react'
import toast from 'react-hot-toast'

const actionMeta = {
  create: { icon: Plus, color: 'text-success bg-success/10 border-success/30' },
  update: { icon: Pencil, color: 'text-primary bg-primary/10 border-primary/30' },
  delete: { icon: Trash2, color: 'text-danger bg-danger/10 border-danger/30' },
  import: { icon: Upload, color: 'text-purple bg-purple/10 border-purple/30' },
  reset: { icon: RotateCcw, color: 'text-warning bg-warning/10 border-warning/30' },
}

function relTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ActivityLog() {
  const { activityLog, clearLog } = useAppStore()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const entities = [...new Set(activityLog.map(l => l.entity))]

  const filtered = activityLog.filter(l => {
    if (actionFilter && l.action !== actionFilter) return false
    if (entityFilter && l.entity !== entityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!l.name?.toLowerCase().includes(q) && !l.details?.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Activity Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            History of all changes · {activityLog.length} event{activityLog.length === 1 ? '' : 's'} recorded
          </p>
        </div>
        <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={activityLog.length === 0}>
          <Eraser size={15} /> Clear Log
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-primary"
            placeholder="Search events…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        >
          <option value="">All Actions</option>
          {Object.keys(actionMeta).map(a => <option key={a} value={a} className="capitalize">{a}</option>)}
        </select>
        <select
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {entities.map(e => <option key={e} value={e} className="capitalize">{e}</option>)}
        </select>
      </div>

      {/* Timeline */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <History size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No activity recorded yet</p>
            <p className="text-slate-600 text-sm mt-1">Changes you make will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(l => {
              const meta = actionMeta[l.action] || actionMeta.update
              const Icon = meta.icon
              return (
                <div key={l.id} className="flex items-center gap-4 px-5 py-3 hover:bg-border/20 transition-colors">
                  <div className={`p-2 rounded-lg border ${meta.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={meta.color}>{l.action}</Badge>
                      <span className="text-xs text-slate-500 capitalize">{l.entity}</span>
                      <span className="text-sm text-slate-200 font-medium">{l.name}</span>
                    </div>
                    {l.details && <p className="text-xs text-slate-500 mt-0.5">{l.details}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">{relTime(l.at)}</p>
                    <p className="text-xs text-slate-600">{new Date(l.at).toLocaleString()}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => { clearLog(); toast.success('Activity log cleared') }}
        title="Clear Activity Log"
        message="All recorded history will be permanently deleted. This cannot be undone."
      />
    </div>
  )
}
