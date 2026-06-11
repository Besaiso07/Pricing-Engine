import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Input, { Select } from '../components/ui/Input'
import {
  fmtLYD, fmtCurrency, fmtPct, sellingPrice, marginPct,
  colorClass, statusColor, planCyclePrice,
} from '../utils/format'
import { BILLING_CYCLES, getCycle } from '../data/mockData'
import PrintPlanButton from '../components/PrintPlanButton'

const cycleShort = {
  monthly: '/ mo', quarterly: '/ qtr', semi_annually: '/ 6mo',
  annually: '/ yr', biennially: '/ 2yr', triennially: '/ 3yr',
}

// Editable row: manual selling price for one billing cycle
function CyclePriceRow({ plan, cycleKey, breakEvenMonthly, markup, onSave, active }) {
  const cyc = getCycle(cycleKey)
  const breakEven = breakEvenMonthly * cyc.months
  const suggested = sellingPrice(breakEvenMonthly, markup) * cyc.months
  const stored = planCyclePrice(plan, cycleKey)
  const [val, setVal] = useState(stored ?? '')
  useEffect(() => { setVal(stored ?? '') }, [stored])

  const margin = stored != null ? marginPct(breakEven, stored) : null
  const dirty = String(val) !== String(stored ?? '')

  return (
    <div className={`rounded-xl p-3 border ${active ? 'border-primary/40 bg-primary/5' : 'border-border bg-bg'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-200">{cyc.label}</span>
        <span className="text-[10px] text-slate-500">×{cyc.months} mo · break-even {fmtLYD(breakEven)}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex gap-1.5">
            <input
              type="number"
              step="0.001"
              min="0"
              className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1.5 text-sm font-mono text-primary focus:outline-none focus:border-primary"
              value={val}
              placeholder={`suggested ${suggested.toFixed(3)}`}
              onChange={e => setVal(e.target.value)}
            />
            <Button size="sm" variant={dirty ? 'primary' : 'ghost'} onClick={() => onSave(cycleKey, val)}>Set</Button>
            {stored != null && (
              <Button size="sm" onClick={() => onSave(cycleKey, '')} title="Clear">✕</Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[11px]">
        <span className="text-slate-500">Suggested: <span className="font-mono text-success">{fmtLYD(suggested)}</span></span>
        {margin != null && (
          <span className="text-slate-500">Margin: <span className={`font-mono font-semibold ${margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-danger'}`}>{fmtPct(margin)}</span></span>
        )}
      </div>
    </div>
  )
}
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Calculator, TrendingUp, DollarSign, Percent, Calendar,
  Layers, Package,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function PlanDetail() {
  const { id } = useParams()
  const {
    plans, updatePlan, components, allocations,
    addAllocation, removeAllocation, updateAllocation,
    getPlanTotalCost, getSetting, costCenters, costCenterPlans,
    getCostCenterPlanCost, getPlanCat, getComponentCat, setPlanCyclePrice,
  } = useAppStore()
  const compCatClass = (key) => colorClass(getComponentCat(key)?.color)
  const compCatLabel = (key) => getComponentCat(key)?.label || key

  const plan = plans.find(p => p.id === id)
  const [showAddDirect, setShowAddDirect] = useState(false)
  const [directForm, setDirectForm] = useState({ component_id: '', allocation_weight: '', allocation_notes: '' })
  const [markupEdit, setMarkupEdit] = useState(plan?.markup_override_pct ?? '')
  const [showCalc, setShowCalc] = useState(true)
  const [period, setPeriod] = useState('monthly') // a billing-cycle key
  const [basis, setBasis] = useState('capacity')  // 'capacity' | 'actual' | 'whole'

  if (!plan) return (
    <div className="p-6">
      <Link to="/plans"><Button><ArrowLeft size={14} /> Back</Button></Link>
      <p className="text-slate-400 mt-4">Plan not found.</p>
    </div>
  )

  const markupDefault = getSetting('default_markup_pct')
  const effectiveMarkup = plan.markup_override_pct ?? markupDefault
  const {
    totalLYD, unitLYD, clientCapacity, clientActual, perClientCapacity, perClientActual,
    isPerClient, directBreakdown, ccContributions, directTotal, ccTotal,
  } = getPlanTotalCost(plan.id)

  // Cost basis: shared plans are priced per client (total ÷ clients).
  const effBasis = isPerClient ? basis : 'whole'
  const divisor = effBasis === 'whole' ? 1 : effBasis === 'actual' ? (clientActual || 1) : (clientCapacity || 1)
  const beMonthly = totalLYD / divisor              // break-even on the chosen basis (per client or whole)
  const price = sellingPrice(beMonthly, effectiveMarkup)
  const margin = marginPct(beMonthly, price)

  const planAllocs = allocations.filter(a => a.plan_id === id)
  const usedCompIds = planAllocs.map(a => a.component_id)
  const availComps = components.filter(c => !usedCompIds.includes(c.id))

  // Cost centers this plan belongs to
  const myCCLinks = costCenterPlans.filter(cp => cp.plan_id === id)

  const addDirect = () => {
    if (!directForm.component_id) return toast.error('Select a component')
    const w = parseFloat(directForm.allocation_weight)
    if (isNaN(w) || w <= 0 || w > 1) return toast.error('Weight must be between 0 and 1')
    addAllocation({ plan_id: id, component_id: directForm.component_id, allocation_weight: w, allocation_notes: directForm.allocation_notes })
    setDirectForm({ component_id: '', allocation_weight: '', allocation_notes: '' })
    setShowAddDirect(false)
    toast.success('Component allocated')
  }

  const saveMarkup = () => {
    const val = markupEdit === '' ? null : parseFloat(markupEdit)
    updatePlan(id, { markup_override_pct: val })
    toast.success('Markup updated')
  }

  const savePrice = (cycleKey, val) => {
    setPlanCyclePrice(id, cycleKey, val)
    toast.success(val === '' ? 'Price cleared' : `${getCycle(cycleKey).label} price set`)
  }

  // ── Period view (per the plan's billing cycles) ──────────────────
  // All costs are computed as monthly equivalents (yearly comps ÷ 12).
  // The selected billing cycle multiplies everything by its # of months.
  const planCycles = plan.billing_cycles?.length ? plan.billing_cycles : ['monthly']
  const activePeriod = planCycles.includes(period) ? period : planCycles[0]
  const cyc = getCycle(activePeriod)
  const mult = cyc.months
  const isMulti = mult > 1
  const per = cycleShort[activePeriod] || `/ ${mult}mo`
  const view = (n) => (n ?? 0) * mult
  const planCatClass = colorClass(getPlanCat(plan.category)?.color)
  const planCatLabel = getPlanCat(plan.category)?.label || plan.category

  // Per-cycle manual price for the currently-viewed cycle
  const cyclePrice = planCyclePrice(plan, activePeriod)        // price for active cycle (per client)
  const cycleBreakEven = beMonthly * mult                       // break-even for active cycle (per basis)
  const cycleSuggested = view(price)                            // suggested price for active cycle
  const actualMargin = cyclePrice != null ? marginPct(cycleBreakEven, cyclePrice) : null
  // Annualised revenue for the active cycle's price (12 / months in cycle)
  const annualRevenue = cyclePrice != null ? cyclePrice * (12 / mult) : cycleSuggested * (12 / mult)

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/plans"><button className="p-2 rounded-xl border border-border text-slate-400 hover:text-slate-200 hover:bg-border/50 transition-colors mt-0.5"><ArrowLeft size={16} /></button></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-100">{plan.name}</h1>
            <Badge className={planCatClass}>{planCatLabel}</Badge>
            <Badge className={statusColor[plan.status]}>{plan.status}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{plan.description}</p>
          {/* Specs */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Object.entries(plan.specs || {}).map(([k, v]) => (
              <span key={k} className="text-xs bg-border/50 text-slate-400 px-2.5 py-1 rounded-full">
                <span className="text-slate-500">{k}:</span> {v}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Billing-cycle period toggle (only the cycles this plan is sold in) */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex rounded-lg border border-border overflow-hidden text-xs flex-wrap">
              {planCycles.map(c => (
                <button
                  key={c}
                  onClick={() => setPeriod(c)}
                  className={`px-2.5 py-2 font-medium transition-colors ${activePeriod === c ? 'bg-primary text-bg' : 'text-slate-400 hover:bg-border/50'}`}
                >
                  {getCycle(c).label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-600">Edit cycles in the sidebar →</span>
          </div>
          <PrintPlanButton planId={id} label="PDF" />
          <Select
            value={plan.status}
            onChange={e => { updatePlan(id, { status: e.target.value }); toast.success('Status updated') }}
            className="w-32"
          >
            {['draft', 'active', 'archived'].map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left: Cost builder */}
        <div className="col-span-2 space-y-4">

          {/* Direct Allocations */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Package size={15} className="text-primary" /> Direct Cost Allocations
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setShowAddDirect(!showAddDirect)}>
                <Plus size={13} /> Add Component
              </Button>
            </div>

            {showAddDirect && (
              <div className="bg-bg rounded-xl p-4 mb-4 space-y-3 border border-border">
                <Select
                  label="Component"
                  value={directForm.component_id}
                  onChange={e => setDirectForm(f => ({ ...f, component_id: e.target.value }))}
                >
                  <option value="">Select component…</option>
                  {availComps.map(c => <option key={c.id} value={c.id}>{c.name} ({c.currency} {c.cost_amount}/{c.billing_cycle})</option>)}
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Allocation Weight (0–1)"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={directForm.allocation_weight}
                    onChange={e => setDirectForm(f => ({ ...f, allocation_weight: e.target.value }))}
                    placeholder="e.g. 0.25 = 25%"
                  />
                  <Input
                    label="Notes"
                    value={directForm.allocation_notes}
                    onChange={e => setDirectForm(f => ({ ...f, allocation_notes: e.target.value }))}
                    placeholder="e.g. 1 license per plan"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={addDirect}>Allocate</Button>
                  <Button size="sm" onClick={() => setShowAddDirect(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {planAllocs.length === 0 && !showAddDirect && (
              <p className="text-xs text-slate-600 italic">No direct allocations. Add cost components or link a Cost Center.</p>
            )}

            {planAllocs.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-border">
                    <th className="text-left pb-2 font-medium">Component</th>
                    <th className="text-left pb-2 font-medium">Billing</th>
                    <th className="text-right pb-2 font-medium">Original Cost</th>
                    <th className="text-right pb-2 font-medium">Cost {per} (LYD)</th>
                    <th className="text-right pb-2 font-medium">Weight</th>
                    <th className="text-right pb-2 font-medium">Allocated {per}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {directBreakdown.map(({ component: c, alloc, monthlyCostLYD, allocatedLYD }) => (
                    <tr key={alloc.id} className="border-b border-border/40 group">
                      <td className="py-2 text-slate-300">
                        {c.name}
                        <Badge className={`ml-1.5 ${compCatClass(c.category)}`}>{compCatLabel(c.category)}</Badge>
                      </td>
                      <td className="py-2">
                        <span className={`capitalize ${c.billing_cycle === 'yearly' ? 'text-purple' : 'text-slate-400'}`}>
                          {c.billing_cycle.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono text-slate-400">
                        {fmtCurrency(c.cost_amount, c.currency)}
                        {c.billing_cycle === 'yearly' && <span className="text-slate-600">/yr</span>}
                        {c.billing_cycle === 'one_time' && <span className="text-slate-600"> once</span>}
                      </td>
                      <td className="py-2 text-right font-mono text-slate-400">
                        {fmtLYD(view(monthlyCostLYD))}
                        {c.billing_cycle === 'yearly' && (
                          <span className="block text-purple text-[10px]">annual ÷ 12{isMulti ? ` × ${mult}` : ''}</span>
                        )}
                        {c.billing_cycle === 'one_time' && (
                          <span className="block text-purple text-[10px]">one-time ÷ {c.amortize_months || 24} mo{isMulti ? ` × ${mult}` : ''}</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          className="w-16 bg-card border border-border rounded px-1.5 py-0.5 text-center text-slate-200 focus:outline-none focus:border-primary"
                          value={alloc.allocation_weight}
                          onChange={e => updateAllocation(alloc.id, { allocation_weight: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-2 text-right font-mono text-warning font-semibold">{fmtLYD(view(allocatedLYD))}</td>
                      <td className="py-2">
                        <button
                          onClick={() => { removeAllocation(alloc.id); toast.success('Removed') }}
                          className="opacity-0 group-hover:opacity-100 text-danger ml-2 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border">
                    <td colSpan={5} className="pt-2 text-slate-400 font-semibold">Direct Subtotal {per}</td>
                    <td className="pt-2 text-right font-mono font-bold text-warning">{fmtLYD(view(directTotal))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>

          {/* Cost Center Contributions */}
          {myCCLinks.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
                <Layers size={15} className="text-purple" /> Cost Center Contributions
              </h2>
              {ccContributions.map(({ costCenter, breakdown, sharedTotal, dedicatedTotal, totalLYD: ccPlanTotal, weight, planClients, totalClients }) => (
                <div key={costCenter.id} className="border border-border rounded-xl p-4 space-y-3 mb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">{costCenter.name}</p>
                    <span className="text-xs text-primary font-mono">{fmtPct(weight * 100)} of pool</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    This plan holds <strong className="text-slate-300">{planClients}</strong> of <strong className="text-slate-300">{totalClients}</strong> total client slots in this cost center.
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-border">
                        <th className="text-left pb-1.5 font-medium">Component</th>
                        <th className="text-left pb-1.5 font-medium">Type</th>
                        <th className="text-right pb-1.5 font-medium">Pool Cost</th>
                        <th className="text-right pb-1.5 font-medium">Allocated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.map(({ component: c, type, monthlyCostLYD, allocatedLYD, weight: w }) => (
                        <tr key={c.id} className="border-b border-border/40">
                          <td className="py-1.5 text-slate-300">{c.name}</td>
                          <td className="py-1.5">
                            <Badge className={type === 'dedicated' ? 'text-purple bg-purple/10 border-purple/30' : 'text-primary bg-primary/10 border-primary/30'}>
                              {type}
                            </Badge>
                          </td>
                          <td className="py-1.5 text-right font-mono text-slate-400">{fmtLYD(monthlyCostLYD)}</td>
                          <td className="py-1.5 text-right font-mono text-warning">{fmtLYD(allocatedLYD)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td colSpan={2} className="pt-2 text-slate-400 font-semibold">
                          Shared: {fmtLYD(sharedTotal)} · Dedicated: {fmtLYD(dedicatedTotal)}
                        </td>
                        <td />
                        <td className="pt-2 text-right font-mono font-bold text-warning">{fmtLYD(ccPlanTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-slate-400 font-semibold">Total from Cost Centers</span>
                <span className="font-mono font-bold text-warning text-sm">{fmtLYD(ccTotal)}</span>
              </div>
            </Card>
          )}

          {/* Calculation Analysis Card */}
          <Card className="p-5">
            <button
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-200 mb-2"
              onClick={() => setShowCalc(b => !b)}
            >
              <span className="flex items-center gap-2"><Calculator size={15} className="text-primary" /> Calculation Analysis</span>
              {showCalc ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
            </button>
            {showCalc && (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-slate-500">
                  How this plan's break-even cost is computed, step by step.
                </p>

                {/* Direct alloc steps */}
                {directBreakdown.length > 0 && (
                  <div className="bg-bg rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-primary">Direct Allocations ({cyc.label})</p>
                    {directBreakdown.map(({ component: c, alloc, monthlyCostLYD, allocatedLYD }) => (
                      <div key={alloc.id} className="text-xs text-slate-400 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-300 font-medium">{c.name}</span>
                          <span className="text-slate-600">·</span>
                          <span className="font-mono">{fmtLYD(view(monthlyCostLYD))} {per.replace(' ', '')}</span>
                          <span className="text-slate-600">×</span>
                          <span className="font-mono text-primary">{(alloc.allocation_weight * 100).toFixed(0)}%</span>
                          <span className="text-slate-600">=</span>
                          <span className="font-mono text-warning">{fmtLYD(view(allocatedLYD))}</span>
                        </div>
                        {c.billing_cycle === 'yearly' && (
                          <div className="text-[11px] text-purple pl-1">
                            ↳ {fmtCurrency(c.cost_amount, c.currency)}/yr ÷ 12 = {fmtLYD(monthlyCostLYD)} / mo
                            {isMulti && ` × ${mult} = ${fmtLYD(monthlyCostLYD * mult)} (${cyc.label})`}
                          </div>
                        )}
                        {c.billing_cycle === 'one_time' && (
                          <div className="text-[11px] text-purple pl-1">
                            ↳ {fmtCurrency(c.cost_amount, c.currency)} once ÷ {c.amortize_months || 24} mo = {fmtLYD(monthlyCostLYD)} / mo (amortized)
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="border-t border-border pt-1.5 flex justify-between text-xs font-semibold">
                      <span className="text-slate-400">Direct subtotal {per}</span>
                      <span className="font-mono text-warning">{fmtLYD(view(directTotal))}</span>
                    </div>
                  </div>
                )}

                {/* CC alloc steps */}
                {ccContributions.map(({ costCenter, breakdown, totalLYD: ccPlanTotal, weight, planClients, totalClients }) => (
                  <div key={costCenter.id} className="bg-bg rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-purple">{costCenter.name} (Cost Center)</p>
                    <p className="text-xs text-slate-500">
                      Weight = {planClients} / {totalClients} = <span className="text-primary font-mono">{fmtPct(weight * 100)}</span>
                    </p>
                    {breakdown.map(({ component: c, type, monthlyCostLYD, allocatedLYD, weight: w }) => (
                      <div key={c.id} className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
                        <span className="text-slate-300 font-medium">{c.name}</span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono">{fmtLYD(view(monthlyCostLYD))}</span>
                        {type === 'shared' ? (
                          <>
                            <span className="text-slate-600">×</span>
                            <span className="font-mono text-primary">{fmtPct(w * 100)}</span>
                            <span className="text-xs text-slate-600">(capacity weight)</span>
                          </>
                        ) : (
                          <span className="text-xs text-purple">(dedicated 100%)</span>
                        )}
                        <span className="text-slate-600">=</span>
                        <span className="font-mono text-warning">{fmtLYD(view(allocatedLYD))}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-1.5 flex justify-between text-xs font-semibold">
                      <span className="text-slate-400">Subtotal from {costCenter.name} {per}</span>
                      <span className="font-mono text-warning">{fmtLYD(view(ccPlanTotal))}</span>
                    </div>
                  </div>
                ))}

                {/* Grand total calc */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500 font-semibold mb-1">
                    <span>Totals ({cyc.label})</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Direct Allocations</span>
                    <span className="font-mono">{fmtLYD(view(directTotal))}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Cost Center Contributions</span>
                    <span className="font-mono">{fmtLYD(view(ccTotal))}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-primary/20 pt-1.5">
                    <span className="text-slate-200">Total Break-Even {per} (all clients)</span>
                    <span className="font-mono text-warning">{fmtLYD(view(totalLYD))}</span>
                  </div>
                  {effBasis !== 'whole' && (
                    <div className="flex justify-between text-primary pt-0.5">
                      <span>÷ {divisor} clients ({effBasis})</span>
                      <span className="font-mono font-semibold">{fmtLYD(view(beMonthly))} / client</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400 pt-0.5">
                    <span>× (1 + {effectiveMarkup}% markup)</span>
                    <span className="font-mono text-success">{fmtLYD(view(price))}{effBasis !== 'whole' ? ' / client' : ''}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Gross Margin = (Price − Cost) / Price</span>
                    <span className={`font-mono font-bold ${margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-danger'}`}>
                      {fmtPct(margin)}
                    </span>
                  </div>
                </div>

                {totalLYD === 0 && (
                  <p className="text-xs text-slate-600 italic">No costs allocated yet. Add direct components or link a cost center.</p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Summary panel */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Pricing Summary</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${isMulti ? 'text-purple bg-purple/10 border-purple/30' : 'text-primary bg-primary/10 border-primary/30'}`}>
                {cyc.label} view
              </span>
            </div>

            {/* Cost basis selector — only relevant for shared (per-client) plans */}
            {isPerClient && (
              <div className="bg-bg rounded-xl p-3 space-y-2">
                <p className="text-xs text-slate-500">Cost basis</p>
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  {[
                    { k: 'capacity', label: `Per client (cap. ${clientCapacity})` },
                    { k: 'actual', label: `Per client (now ${clientActual})` },
                    { k: 'whole', label: 'Whole plan' },
                  ].map(o => (
                    <button
                      key={o.k}
                      onClick={() => setBasis(o.k)}
                      disabled={o.k === 'actual' && !clientActual}
                      className={`flex-1 px-2 py-1.5 font-medium transition-colors disabled:opacity-30 ${effBasis === o.k ? 'bg-primary text-bg' : 'text-slate-400 hover:bg-border/50'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="bg-bg rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={13} className="text-warning" />
                  <p className="text-xs text-slate-500">
                    Break-Even {effBasis !== 'whole' ? 'per Client' : 'Cost'} {per}
                  </p>
                </div>
                <p className="text-xl font-bold font-mono text-warning">{fmtLYD(view(beMonthly))}</p>
                {effBasis !== 'whole' && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    {fmtLYD(view(totalLYD))} total ÷ {divisor} clients
                  </p>
                )}
                {effBasis === 'whole' && isMulti && (
                  <p className="text-xs text-slate-600 mt-0.5">{fmtLYD(totalLYD)} / mo × {mult}</p>
                )}
              </div>

              <div className="bg-bg rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Percent size={13} className="text-primary" />
                  <p className="text-xs text-slate-500">Markup %</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-primary"
                    value={markupEdit}
                    placeholder={`${markupDefault} (default)`}
                    onChange={e => setMarkupEdit(e.target.value)}
                  />
                  <Button size="sm" variant="primary" onClick={saveMarkup}>Set</Button>
                </div>
                {plan.markup_override_pct === null && (
                  <p className="text-xs text-slate-600 mt-1">Using default: {markupDefault}%</p>
                )}
              </div>

              <div className="bg-bg rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={13} className="text-success" />
                  <p className="text-xs text-slate-500">Suggested Sell Price {per}</p>
                </div>
                <p className="text-xl font-bold font-mono text-success">{fmtLYD(view(price))}</p>
              </div>

              {/* Current Price for the active cycle (read-out; edit per-cycle below) */}
              <div className="bg-bg rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={13} className="text-primary" />
                  <p className="text-xs text-slate-500">Current Price ({cyc.label})</p>
                </div>
                {cyclePrice != null ? (
                  <>
                    <p className="text-xl font-bold font-mono text-primary">{fmtLYD(cyclePrice)}</p>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className="text-slate-500">vs suggested</span>
                      <span className={`font-mono font-semibold ${cyclePrice >= cycleSuggested ? 'text-success' : 'text-warning'}`}>
                        {cyclePrice >= cycleSuggested ? '+' : ''}{fmtLYD(cyclePrice - cycleSuggested)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-600 italic">Not set — add it in “Prices by Cycle” below</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bg rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">Suggested Margin</p>
                  <p className={`text-base font-bold ${margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-danger'}`}>
                    {fmtPct(margin)}
                  </p>
                </div>
                <div className="bg-bg rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">Actual Margin ({cyc.label})</p>
                  {actualMargin != null ? (
                    <p className={`text-base font-bold ${actualMargin >= 30 ? 'text-success' : actualMargin >= 15 ? 'text-warning' : 'text-danger'}`}>
                      {fmtPct(actualMargin)}
                    </p>
                  ) : (
                    <p className="text-base font-bold text-slate-600">—</p>
                  )}
                </div>
              </div>

              <div className="bg-bg rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">
                  Annual Revenue {cyclePrice != null ? '(at current price)' : '(at suggested)'}
                </p>
                <p className="text-base font-bold font-mono text-slate-200">{fmtLYD(annualRevenue)}</p>
              </div>
            </div>
          </Card>

          {/* Prices by billing cycle — each cycle has its own manual price */}
          <Card className="p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <DollarSign size={12} className="text-primary" /> Prices by Billing Cycle
              </p>
              <p className="text-xs text-slate-600 mt-0.5">Set the actual selling price for each cycle this plan is sold in.</p>
            </div>
            {planCycles.map(c => (
              <CyclePriceRow
                key={c}
                plan={plan}
                cycleKey={c}
                breakEvenMonthly={beMonthly}
                markup={effectiveMarkup}
                onSave={savePrice}
                active={c === activePeriod}
              />
            ))}
          </Card>

          {/* Cost breakdown mini */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-400 mb-3">Cost Sources {per}</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5"><Package size={11} /> Direct</span>
                <span className="font-mono text-slate-300">{fmtLYD(view(directTotal))}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5"><Layers size={11} /> Cost Centers ({myCCLinks.length})</span>
                <span className="font-mono text-slate-300">{fmtLYD(view(ccTotal))}</span>
              </div>
              {totalLYD > 0 && (
                <div className="mt-2 h-2 rounded-full bg-border overflow-hidden flex">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${(directTotal / totalLYD) * 100}%` }}
                  />
                  <div className="h-full bg-purple flex-1" />
                </div>
              )}
            </div>
          </Card>

          {/* Billing cycles sold */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-400 mb-1">Billing Cycles Sold</p>
            <p className="text-xs text-slate-600 mb-2">Toggle which cycles this plan is offered in.</p>
            <div className="grid grid-cols-2 gap-2">
              {BILLING_CYCLES.map(c => {
                const active = planCycles.includes(c.key)
                return (
                  <button
                    key={c.key}
                    onClick={() => {
                      const next = active
                        ? planCycles.filter(k => k !== c.key)
                        : [...planCycles, c.key]
                      if (next.length === 0) return toast.error('Keep at least one cycle')
                      updatePlan(id, { billing_cycles: next })
                      toast.success(`${c.label} ${active ? 'removed' : 'added'}`)
                    }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active ? 'bg-primary text-bg border-primary' : 'border-border text-slate-500 hover:bg-border/50'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Status change */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">Plan Status</p>
            <div className="flex flex-col gap-2">
              {['draft', 'active', 'archived'].map(s => (
                <button
                  key={s}
                  onClick={() => { updatePlan(id, { status: s }); toast.success(`Status → ${s}`) }}
                  className={`text-left px-3 py-2 rounded-lg text-xs transition-colors capitalize border ${
                    plan.status === s ? statusColor[s] : 'border-border text-slate-500 hover:bg-border/50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
