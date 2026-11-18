import { useState } from 'react'
import useAppStore from '../store/appStore'
import Card from './ui/Card'
import { fmtLYD } from '../utils/format'
import { History, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'

const KIND = {
  price: { label: 'Selling price', cls: 'text-success bg-success/10 border-success/30' },
  cost: { label: 'Cost', cls: 'text-warning bg-warning/10 border-warning/30' },
  capacity: { label: 'Capacity', cls: 'text-purple bg-purple/10 border-purple/30' },
  rate: { label: 'Exchange rate', cls: 'text-primary bg-primary/10 border-primary/30' },
  setting: { label: 'Setting', cls: 'text-muted bg-muted/10 border-muted/30' },
  plan: { label: 'Plan', cls: 'text-primary bg-primary/10 border-primary/30' },
}
const FILTERS = [
  { k: 'all', label: 'All' },
  { k: 'price', label: 'Prices' },
  { k: 'cost', label: 'Costs' },
  { k: 'capacity', label: 'Capacity' },
  { k: 'rates', label: 'Rates & settings' },
  { k: 'plan', label: 'Plan details' },
]
const PAGE = 15

// "before → after" of a monthly LYD figure with % change
function Move({ label, from, to }) {
  const d = to - from
  if (Math.abs(d) < 0.0005) return null
  const pct = from > 0 ? (d / from) * 100 : null
  return (
    <span className="whitespace-nowrap">
      {label}: <span className="font-mono text-slate-500 line-through decoration-slate-600/50">{fmtLYD(from)}</span>
      {' → '}<span className="font-mono font-semibold text-slate-200">{fmtLYD(to)}</span>
      <span className={`ml-1 font-mono ${d > 0 ? 'text-danger' : 'text-success'}`}>
        ({d > 0 ? '+' : ''}{pct != null ? `${pct.toFixed(1)}%` : fmtLYD(d)})
      </span>
    </span>
  )
}

// Per-plan change log: every change that affected this plan, with before → after and cost impact.
export default function PlanHistory({ planId, isPerClient }) {
  const history = useAppStore(s => s.planHistory).filter(h => h.planId === planId)
  const [open, setOpen] = useState(true)
  const [filter, setFilter] = useState('all')
  const [shown, setShown] = useState(PAGE)

  const list = history.filter(h =>
    filter === 'all' ? true : filter === 'rates' ? (h.kind === 'rate' || h.kind === 'setting') : h.kind === filter)
  const since = history.length ? new Date(history[history.length - 1].at) : null
  const costLabel = isPerClient ? 'Cost / client / mo' : 'Break-even / mo'

  return (
    <Card className="p-5">
      <button className="w-full flex items-center justify-between text-sm font-semibold text-slate-200" onClick={() => setOpen(o => !o)}>
        <span className="flex items-center gap-2">
          <History size={15} className="text-primary" /> History
          <span className="text-xs font-normal text-slate-500">{history.length} change{history.length === 1 ? '' : 's'}</span>
        </span>
        {open ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(f => (
              <button key={f.k} onClick={() => { setFilter(f.k); setShown(PAGE) }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter === f.k ? 'bg-primary text-bg border-primary' : 'border-border text-slate-400 hover:bg-border/50'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              {history.length === 0
                ? 'No changes recorded yet. From now on, every change to this plan’s prices, costs, capacity or exchange rates is recorded here with its before and after values.'
                : 'No changes of this type.'}
            </p>
          ) : (
            <ol className="relative border-l border-border ml-1.5 space-y-3">
              {list.slice(0, shown).map(h => {
                const k = KIND[h.kind] || KIND.setting
                const d = new Date(h.at)
                return (
                  <li key={h.id} className="ml-4">
                    <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-card border-2 border-primary/60" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} · {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${k.cls}`}>{k.label}</span>
                      <span className="text-sm text-slate-200 font-medium">{h.title}</span>
                    </div>
                    {h.changes?.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {h.changes.map((c, i) => (
                          <div key={i} className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>{c.label}:</span>
                            <span className="font-mono text-slate-500 line-through decoration-slate-600/50">{c.from}</span>
                            <ArrowRight size={11} className="text-slate-600" />
                            <span className="font-mono font-semibold text-slate-200">{c.to}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {h.cost && (
                      <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
                        <Move label={costLabel} from={h.cost.from} to={h.cost.to} />
                        <Move label="Suggested / mo" from={h.suggested.from} to={h.suggested.to} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}

          {list.length > shown && (
            <button onClick={() => setShown(n => n + PAGE)} className="text-xs text-primary hover:underline">
              Show {Math.min(PAGE, list.length - shown)} more…
            </button>
          )}
          {since && (
            <p className="text-[10px] text-slate-600">
              Recording since {since.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}. Amounts in LYD per month at the rates in force at the time.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
