import { useState } from 'react'
import { Link } from 'react-router-dom'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { ConfirmModal } from '../components/ui/Modal'
import {
  fmtLYD, fmtPct, sellingPrice, marginPct, planCyclePrice, colorClass,
} from '../utils/format'
import {
  TrendingUp, AlertTriangle, Check, Sliders, ExternalLink, Save, RotateCcw,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Simulator() {
  const {
    plans, getSetting, getSettingRaw, updateSetting,
    components, allocations, costCenters, costCenterPlans, costCenterComponents,
    fxRate, planCategories, getPlanCat, monthlyComponentCostAtRates,
  } = useAppStore()
  const catClass = (key) => colorClass(getPlanCat(key)?.color)
  const catLabel = (key) => getPlanCat(key)?.label || key

  const mode = getSettingRaw('fx_mode') || 'official'
  const baseUsd = mode === 'parallel' ? getSetting('usd_to_lyd_parallel') : getSetting('usd_to_lyd')
  const baseEur = mode === 'parallel' ? getSetting('eur_to_lyd_parallel') : getSetting('eur_to_lyd')
  const buffer = getSetting('fx_buffer_pct')
  const targetMargin = getSetting('target_margin_pct')

  const [simUsd, setSimUsd] = useState(baseUsd)
  const [simEur, setSimEur] = useState(baseEur)
  const [period, setPeriod] = useState('monthly') // 'monthly' | 'annual'
  const [applyConfirm, setApplyConfirm] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const [sortKey, setSortKey] = useState('name') // 'name'|'baseBE'|'simBE'|'deltaBE'|'periodPrice'|'heldMargin'|'suggestedNew'
  const [sortDir, setSortDir] = useState('asc') // 'asc'|'desc'

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortTh = ({ label, k, align = 'right' }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-4 py-2.5 font-medium cursor-pointer select-none hover:text-slate-300 transition-colors ${align === 'left' ? 'text-left' : 'text-right'}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        {sortKey === k
          ? (sortDir === 'asc' ? <ArrowUp size={11} className="text-primary" /> : <ArrowDown size={11} className="text-primary" />)
          : <ArrowUpDown size={11} className="opacity-30" />}
      </span>
    </th>
  )

  const months = period === 'annual' ? 12 : 1
  const per = period === 'annual' ? '/ yr' : '/ mo'

  // Recompute a plan's monthly break-even using arbitrary rates (no store mutation).
  // Uses the store's shared cost math so one_time amortization & inflation stay consistent.
  const breakEvenAt = (planId, usdRate, eurRate) => {
    const monthly = (comp) => monthlyComponentCostAtRates(comp, usdRate, eurRate)
    // direct
    let total = 0
    allocations.filter(a => a.plan_id === planId).forEach(a => {
      const c = components.find(x => x.id === a.component_id)
      if (c) total += monthly(c) * (a.allocation_weight || 0)
    })
    // cost centers
    const ccLinks = costCenterPlans.filter(cp => cp.plan_id === planId)
    ccLinks.forEach(cp => {
      const ccPlans = costCenterPlans.filter(p => p.cost_center_id === cp.cost_center_id)
      const totalClients = ccPlans.reduce((s, p) => s + (p.max_clients || 0), 0)
      const weight = totalClients > 0 ? (cp.max_clients || 0) / totalClients : 0
      costCenterComponents.filter(l => l.cost_center_id === cp.cost_center_id).forEach(l => {
        const c = components.find(x => x.id === l.component_id)
        if (!c) return
        if (l.is_dedicated && l.dedicated_plan_id === planId) total += monthly(c)
        else if (!l.is_dedicated) total += monthly(c) * weight
      })
    })
    return total
  }

  const rows = plans.map(p => {
    const markup = p.markup_override_pct ?? getSetting('default_markup_pct')
    // per-client divisor: shared plans are priced per client (total ÷ capacity)
    const clientCapacity = costCenterPlans
      .filter(cp => cp.plan_id === p.id)
      .reduce((s, cp) => s + (cp.max_clients || 0), 0)
    const divisor = clientCapacity > 0 ? clientCapacity : 1
    // monthly per-client figures
    const baseBEm = breakEvenAt(p.id, baseUsd, baseEur) / divisor
    const simBEm = breakEvenAt(p.id, simUsd, simEur) / divisor
    const monthlyPrice = planCyclePrice(p, 'monthly')
    // period figures (×12 for annual)
    const baseBE = baseBEm * months
    const simBE = simBEm * months
    const deltaBE = simBE - baseBE
    const suggestedNew = sellingPrice(simBEm, markup) * months
    // your price for the period: use the cycle's set price if any, else monthly × months
    const cycleKey = period === 'annual' ? 'annually' : 'monthly'
    const periodPrice = planCyclePrice(p, cycleKey) ?? (monthlyPrice != null ? monthlyPrice * months : null)
    // margin if you hold today's price at the new cost
    const heldMargin = periodPrice != null ? marginPct(simBE, periodPrice) : null
    return { p, markup, baseBE, simBE, periodPrice, heldMargin, suggestedNew, deltaBE }
  })

  // Category filter
  const filteredRows = catFilter ? rows.filter(r => r.p.category === catFilter) : rows

  // Sorting (nulls always last)
  const sortVal = (r) => sortKey === 'name' ? r.p.name.toLowerCase() : r[sortKey]
  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = sortVal(a), bv = sortVal(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    let cmp
    if (typeof av === 'string') cmp = av.localeCompare(bv)
    else cmp = av - bv
    return sortDir === 'asc' ? cmp : -cmp
  })

  const atRisk = rows.filter(r => r.heldMargin != null && r.heldMargin < targetMargin)
  const goNegative = rows.filter(r => r.heldMargin != null && r.heldMargin < 0)

  const usdChange = baseUsd ? ((simUsd / baseUsd - 1) * 100) : 0
  const eurChange = baseEur ? ((simEur / baseEur - 1) * 100) : 0

  const applyRates = () => {
    if (mode === 'parallel') {
      updateSetting('usd_to_lyd_parallel', simUsd)
      updateSetting('eur_to_lyd_parallel', simEur)
    } else {
      updateSetting('usd_to_lyd', simUsd)
      updateSetting('eur_to_lyd', simEur)
    }
    toast.success('New rates applied to all plan costs')
  }

  const reset = () => { setSimUsd(baseUsd); setSimEur(baseEur) }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">FX & Inflation Simulator</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Model a dinar move and see which plans go underwater — using the {mode === 'parallel' ? 'parallel' : 'official'} rate.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Monthly / Annual period toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs mr-1">
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-3 py-2 font-medium transition-colors ${period === 'monthly' ? 'bg-primary text-bg' : 'text-slate-400 hover:bg-border/50'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriod('annual')}
              className={`px-3 py-2 font-medium transition-colors ${period === 'annual' ? 'bg-primary text-bg' : 'text-slate-400 hover:bg-border/50'}`}
            >
              Annually
            </button>
          </div>
          <Button onClick={reset}><RotateCcw size={14} /> Reset</Button>
          <Button variant="primary" onClick={() => setApplyConfirm(true)}>
            <Save size={14} /> Apply rates to all plans
          </Button>
        </div>
      </div>

      {/* Rate controls */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'USD → LYD', base: baseUsd, val: simUsd, set: setSimUsd, change: usdChange },
          { label: 'EUR → LYD', base: baseEur, val: simEur, set: setSimEur, change: eurChange },
        ].map(r => (
          <Card key={r.label} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Sliders size={14} className="text-primary" /> {r.label}</p>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${r.change > 0 ? 'text-danger bg-danger/10 border-danger/30' : r.change < 0 ? 'text-success bg-success/10 border-success/30' : 'text-slate-500 border-border'}`}>
                {r.change >= 0 ? '+' : ''}{r.change.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={(r.base * 0.7).toFixed(2)}
              max={(r.base * 2).toFixed(2)}
              step="0.01"
              value={r.val}
              onChange={e => r.set(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">current: <span className="font-mono text-slate-300">{r.base.toFixed(3)}</span></span>
              <input
                type="number"
                step="0.01"
                value={r.val}
                onChange={e => r.set(parseFloat(e.target.value) || 0)}
                className="w-24 bg-bg border border-border rounded-lg px-2 py-1 text-sm font-mono text-warning text-right focus:outline-none focus:border-primary"
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-warning/15 text-warning"><AlertTriangle size={18} /></div>
          <div>
            <p className="text-xs text-slate-500">Below target ({fmtPct(targetMargin)})</p>
            <p className="text-lg font-bold text-warning">{atRisk.length} plan{atRisk.length === 1 ? '' : 's'}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-danger/15 text-danger"><AlertTriangle size={18} /></div>
          <div>
            <p className="text-xs text-slate-500">Loss-making (negative margin)</p>
            <p className="text-lg font-bold text-danger">{goNegative.length} plan{goNegative.length === 1 ? '' : 's'}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15 text-primary"><TrendingUp size={18} /></div>
          <div>
            <p className="text-xs text-slate-500">Buffer applied</p>
            <p className="text-lg font-bold text-primary">{fmtPct(buffer)}</p>
          </div>
        </Card>
      </div>

      {/* Plan impact table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-slate-300">
              Plan Impact ({period === 'annual' ? 'annually' : 'monthly'})
              <span className="text-xs font-normal text-slate-500 ml-2">{sortedRows.length} of {rows.length} plans</span>
            </p>
            <p className="text-xs text-slate-500">“Margin held” = your margin if you keep today's price at the new cost. Click a column to sort.</p>
          </div>
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
          >
            <option value="">All Categories</option>
            {planCategories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg/50">
            <tr className="text-xs text-slate-500 border-b border-border">
              <SortTh label="Plan" k="name" align="left" />
              <SortTh label={`Break-Even now ${per}`} k="baseBE" />
              <SortTh label={`Break-Even sim ${per}`} k="simBE" />
              <SortTh label={`Δ Cost ${per}`} k="deltaBE" />
              <SortTh label={`Your Price ${per}`} k="periodPrice" />
              <SortTh label="Margin held" k="heldMargin" />
              <SortTh label={`New suggested ${per}`} k="suggestedNew" />
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(r => (
              <tr key={r.p.id} className={`border-b border-border/50 hover:bg-border/20 transition-colors ${r.heldMargin != null && r.heldMargin < 0 ? 'bg-danger/5' : ''}`}>
                <td className="px-4 py-2.5">
                  <span className="text-slate-200 font-medium">{r.p.name}</span>
                  <Badge className={`ml-2 ${catClass(r.p.category)}`}>{catLabel(r.p.category)}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-400">{fmtLYD(r.baseBE)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-warning">{fmtLYD(r.simBE)}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  <span className={r.deltaBE > 0 ? 'text-danger' : r.deltaBE < 0 ? 'text-success' : 'text-slate-500'}>
                    {r.deltaBE >= 0 ? '+' : ''}{fmtLYD(r.deltaBE)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-primary">
                  {r.periodPrice != null ? fmtLYD(r.periodPrice) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {r.heldMargin != null ? (
                    <span className={r.heldMargin < 0 ? 'text-danger font-bold' : r.heldMargin < targetMargin ? 'text-warning' : 'text-success'}>
                      {fmtPct(r.heldMargin)}
                    </span>
                  ) : <span className="text-slate-600">no price set</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-success">{fmtLYD(r.suggestedNew)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link to={`/plans/${r.p.id}`}><Button size="sm"><ExternalLink size={12} /></Button></Link>
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-500">No plans in this category.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <ConfirmModal
        open={applyConfirm}
        onClose={() => setApplyConfirm(false)}
        onConfirm={applyRates}
        title="Apply simulated rates"
        message={`This sets the ${mode} USD/EUR rates to the simulated values for all future costing. Plan prices you've set manually are not changed — only costs. Continue?`}
      />
    </div>
  )
}
