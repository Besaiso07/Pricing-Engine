import { useState } from 'react'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal, { ConfirmModal } from '../components/ui/Modal'
import Input, { Select, Textarea } from '../components/ui/Input'
import { fmtLYD, fmtCurrency, fmtPct, colorClass, sellingPrice, planCyclePrice } from '../utils/format'
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronUp,
  Layers, Users, Package, Info, Calculator,
} from 'lucide-react'
import toast from 'react-hot-toast'

const emptyCC = { name: '', description: '', category: 'shared_hosting' }

// ── Calculation Breakdown Card ─────────────────────────────────────────────
function CalcBreakdownCard({ ccId }) {
  const {
    costCenters, costCenterComponents, costCenterPlans,
    components, plans, monthlyComponentCost, getCostCenterPlanCost, getSetting,
  } = useAppStore()

  const cc = costCenters.find(c => c.id === ccId)
  if (!cc) return null

  const ccComps = costCenterComponents.filter(c => c.cost_center_id === ccId)
  const ccPlans = costCenterPlans.filter(p => p.cost_center_id === ccId)
  const totalClients = ccPlans.reduce((s, p) => s + (p.max_clients || 0), 0)
  const markupDefault = getSetting('default_markup_pct')

  // Total shared cost (all non-dedicated components)
  const sharedComps = ccComps.filter(c => !c.is_dedicated)
  const totalSharedCostLYD = sharedComps.reduce((s, link) => {
    const comp = components.find(c => c.id === link.component_id)
    return comp ? s + monthlyComponentCost(comp) : s
  }, 0)

  // Dedicated components (may be for specific plans)
  const dedicatedComps = ccComps.filter(c => c.is_dedicated)

  return (
    <div className="mt-4 border-t border-border pt-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Calculator size={15} className="text-primary" />
        Allocation Methodology & Breakdown
      </div>

      {/* Step 1 – Total Shared Pool */}
      <div className="bg-bg rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 1 — Shared Cost Pool</p>
        <p className="text-xs text-slate-500 mb-3">
          All non-dedicated components form a shared pool. The total monthly cost of this pool is divided among plans proportionally to their client capacity.
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-border">
              <th className="text-left pb-1.5 font-medium">Component</th>
              <th className="text-left pb-1.5 font-medium">Cycle</th>
              <th className="text-right pb-1.5 font-medium">Original</th>
              <th className="text-right pb-1.5 font-medium">Monthly (LYD)</th>
            </tr>
          </thead>
          <tbody>
            {sharedComps.map(link => {
              const comp = components.find(c => c.id === link.component_id)
              if (!comp) return null
              const monthly = monthlyComponentCost(comp)
              return (
                <tr key={link.id} className="border-b border-border/40">
                  <td className="py-1.5 text-slate-300">{comp.name}</td>
                  <td className="py-1.5 text-slate-500 capitalize">{comp.billing_cycle.replace('_',' ')}</td>
                  <td className="py-1.5 text-right font-mono text-slate-400">{fmtCurrency(comp.cost_amount, comp.currency)}</td>
                  <td className="py-1.5 text-right font-mono text-warning">{fmtLYD(monthly)}</td>
                </tr>
              )
            })}
            {sharedComps.length === 0 && (
              <tr><td colSpan={4} className="py-2 text-slate-600 italic">No shared components</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td colSpan={3} className="pt-2 text-slate-400 font-semibold text-xs">Total Shared Pool / month</td>
              <td className="pt-2 text-right font-mono font-bold text-warning">{fmtLYD(totalSharedCostLYD)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Step 2 – Client Capacity Weights */}
      <div className="bg-bg rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 2 — Capacity Weights</p>
        <p className="text-xs text-slate-500 mb-3">
          Each plan's weight = its max clients ÷ total max clients across all plans in this center.
        </p>
        {totalClients === 0 ? (
          <p className="text-xs text-slate-600 italic">Add plans with client capacities to see weights.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex text-xs text-slate-500 pb-1 border-b border-border">
              <span className="flex-1">Plan</span>
              <span className="w-24 text-right">Max Clients</span>
              <span className="w-24 text-right">Weight</span>
              <span className="w-28 text-right">Shared Cost</span>
            </div>
            {ccPlans.map(cp => {
              const plan = plans.find(p => p.id === cp.plan_id)
              const weight = totalClients > 0 ? cp.max_clients / totalClients : 0
              const share = totalSharedCostLYD * weight
              return (
                <div key={cp.id} className="flex items-center text-xs">
                  <span className="flex-1 text-slate-300">{plan?.name || 'Unknown'}</span>
                  <span className="w-24 text-right font-mono text-slate-400">{cp.max_clients}</span>
                  <span className="w-24 text-right font-mono text-primary">{fmtPct(weight * 100)}</span>
                  <span className="w-28 text-right font-mono text-warning">{fmtLYD(share)}</span>
                </div>
              )
            })}
            <div className="flex items-center text-xs border-t border-border pt-1.5 font-semibold">
              <span className="flex-1 text-slate-400">Total</span>
              <span className="w-24 text-right font-mono text-slate-300">{totalClients}</span>
              <span className="w-24 text-right font-mono text-primary">100%</span>
              <span className="w-28 text-right font-mono text-warning">{fmtLYD(totalSharedCostLYD)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Step 3 – Dedicated costs */}
      {dedicatedComps.length > 0 && (
        <div className="bg-bg rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 3 — Dedicated Costs</p>
          <p className="text-xs text-slate-500 mb-3">
            Dedicated costs are 100% allocated to a specific plan, regardless of capacity weights.
          </p>
          <div className="space-y-1.5">
            {dedicatedComps.map(link => {
              const comp = components.find(c => c.id === link.component_id)
              const plan = plans.find(p => p.id === link.dedicated_plan_id)
              if (!comp) return null
              const monthly = monthlyComponentCost(comp)
              return (
                <div key={link.id} className="flex items-center text-xs gap-3">
                  <span className="flex-1 text-slate-300">{comp.name}</span>
                  <span className="text-purple text-xs">→ {plan?.name || 'Unknown plan'}</span>
                  <span className="font-mono text-warning w-28 text-right">{fmtLYD(monthly)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 4 – Per-plan summary */}
      {ccPlans.length > 0 && (
        <div className="bg-bg rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 4 — Per-Plan Cost Summary</p>
          <p className="text-xs text-slate-500 mb-3">
            Total cost per plan = shared allocation + dedicated costs for that plan.
            Formula: <span className="font-mono text-slate-300">cost_center_total / total_clients × plan_clients + dedicated_costs</span>
          </p>
          <div className="space-y-2">
            {ccPlans.map(cp => {
              const plan = plans.find(p => p.id === cp.plan_id)
              const result = getCostCenterPlanCost(ccId, cp.plan_id)
              const markup = plan?.markup_override_pct ?? getSetting('default_markup_pct')
              const price = sellingPrice(result.totalLYD, markup)
              // per-client monthly selling price → break-even client count for this center's share
              const pricePerClient = planCyclePrice(plan, 'monthly')
              const breakEvenClients = pricePerClient ? Math.ceil(result.totalLYD / pricePerClient) : null
              const contribution = pricePerClient != null
                ? pricePerClient * result.actualClients - result.totalLYD
                : null
              return (
                <div key={cp.id} className="border border-border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-200">{plan?.name || 'Unknown'}</p>
                    <Badge className="text-xs border-primary/30 text-primary bg-primary/10">
                      {result.actualClients}/{cp.max_clients} · {fmtPct(result.occupancy * 100)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Weight</p>
                      <p className="font-mono text-primary">{fmtPct(result.weight * 100)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Break-Even</p>
                      <p className="font-mono text-warning">{fmtLYD(result.totalLYD)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Cost/client (cap.)</p>
                      <p className="font-mono text-slate-300">{fmtLYD(result.costPerCapacityClient)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Cost/client (now)</p>
                      <p className="font-mono text-danger">{result.actualClients > 0 ? fmtLYD(result.costPerActualClient) : '—'}</p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 pt-1 border-t border-border/50 grid grid-cols-2 gap-2">
                    <span>
                      Break-even occupancy:{' '}
                      {breakEvenClients != null
                        ? <span className="font-mono text-warning">{breakEvenClients} clients</span>
                        : <span className="text-slate-600">set monthly price</span>}
                    </span>
                    <span className="text-right">
                      Monthly contribution:{' '}
                      {contribution != null
                        ? <span className={`font-mono font-semibold ${contribution >= 0 ? 'text-success' : 'text-danger'}`}>{fmtLYD(contribution)}</span>
                        : <span className="text-slate-600">—</span>}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cost Center Detail (expanded row) ─────────────────────────────────────
function CostCenterDetail({ cc }) {
  const {
    components, plans, costCenterComponents, costCenterPlans,
    addCostCenterComponent, removeCostCenterComponent, updateCostCenterComponent,
    addCostCenterPlan, removeCostCenterPlan, updateCostCenterPlan,
    getCostCenterPlanCost, getSetting,
  } = useAppStore()

  const [showAddComp, setShowAddComp] = useState(false)
  const [showAddPlan, setShowAddPlan] = useState(false)
  const [compForm, setCompForm] = useState({ component_id: '', is_dedicated: false, dedicated_plan_id: '' })
  const [planForm, setPlanForm] = useState({ plan_id: '', max_clients: '', actual_clients: '' })
  const [showBreakdown, setShowBreakdown] = useState(false)

  const ccComps = costCenterComponents.filter(c => c.cost_center_id === cc.id)
  const ccPlans = costCenterPlans.filter(p => p.cost_center_id === cc.id)

  const usedCompIds = ccComps.map(c => c.component_id)
  const usedPlanIds = ccPlans.map(p => p.plan_id)
  const availComps = components.filter(c => !usedCompIds.includes(c.id))
  const availPlans = plans.filter(p => !usedPlanIds.includes(p.id))

  const addComp = () => {
    if (!compForm.component_id) return toast.error('Select a component')
    addCostCenterComponent({
      cost_center_id: cc.id,
      component_id: compForm.component_id,
      is_dedicated: compForm.is_dedicated,
      dedicated_plan_id: compForm.is_dedicated ? compForm.dedicated_plan_id : null,
    })
    setCompForm({ component_id: '', is_dedicated: false, dedicated_plan_id: '' })
    setShowAddComp(false)
    toast.success('Component added to cost center')
  }

  const addPlan = () => {
    if (!planForm.plan_id) return toast.error('Select a plan')
    if (!planForm.max_clients || planForm.max_clients <= 0) return toast.error('Enter max clients')
    addCostCenterPlan({
      cost_center_id: cc.id,
      plan_id: planForm.plan_id,
      max_clients: parseInt(planForm.max_clients),
      actual_clients: parseInt(planForm.actual_clients) || 0,
    })
    setPlanForm({ plan_id: '', max_clients: '', actual_clients: '' })
    setShowAddPlan(false)
    toast.success('Plan added to cost center')
  }

  return (
    <div className="px-5 pb-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Components side */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Package size={13} /> Cost Components
            </p>
            <Button size="sm" variant="ghost" onClick={() => setShowAddComp(!showAddComp)}>
              <Plus size={12} /> Add
            </Button>
          </div>

          {showAddComp && (
            <div className="bg-bg rounded-xl p-3 mb-3 space-y-2 border border-border">
              <Select
                label="Component"
                value={compForm.component_id}
                onChange={e => setCompForm(f => ({ ...f, component_id: e.target.value }))}
              >
                <option value="">Select component…</option>
                {availComps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compForm.is_dedicated}
                  onChange={e => setCompForm(f => ({ ...f, is_dedicated: e.target.checked }))}
                  className="rounded"
                />
                Dedicated to a specific plan
              </label>
              {compForm.is_dedicated && (
                <Select
                  label="Dedicated Plan"
                  value={compForm.dedicated_plan_id}
                  onChange={e => setCompForm(f => ({ ...f, dedicated_plan_id: e.target.value }))}
                >
                  <option value="">Select plan…</option>
                  {ccPlans.map(cp => {
                    const p = plans.find(x => x.id === cp.plan_id)
                    return p ? <option key={cp.id} value={p.id}>{p.name}</option> : null
                  })}
                </Select>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="primary" onClick={addComp}>Add</Button>
                <Button size="sm" onClick={() => setShowAddComp(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {ccComps.map(link => {
              const comp = components.find(c => c.id === link.component_id)
              const dedPlan = link.dedicated_plan_id ? plans.find(p => p.id === link.dedicated_plan_id) : null
              if (!comp) return null
              return (
                <div key={link.id} className="flex items-center gap-2 bg-bg rounded-lg px-3 py-2 text-xs group">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 truncate">{comp.name}</p>
                    {link.is_dedicated && (
                      <p className="text-purple text-xs">Dedicated → {dedPlan?.name || '?'}</p>
                    )}
                    {!link.is_dedicated && (
                      <p className="text-slate-600">Shared (capacity-weighted)</p>
                    )}
                  </div>
                  <Badge className={link.is_dedicated ? 'text-purple bg-purple/10 border-purple/30' : 'text-primary bg-primary/10 border-primary/30'}>
                    {link.is_dedicated ? 'dedicated' : 'shared'}
                  </Badge>
                  <button
                    onClick={() => { removeCostCenterComponent(link.id); toast.success('Removed') }}
                    className="opacity-0 group-hover:opacity-100 text-danger hover:text-danger/80 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
            {ccComps.length === 0 && (
              <p className="text-xs text-slate-600 italic px-1">No components yet. Add costs to allocate.</p>
            )}
          </div>
        </div>

        {/* Plans side */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Users size={13} /> Plans & Client Capacities
            </p>
            <Button size="sm" variant="ghost" onClick={() => setShowAddPlan(!showAddPlan)}>
              <Plus size={12} /> Add
            </Button>
          </div>

          {showAddPlan && (
            <div className="bg-bg rounded-xl p-3 mb-3 space-y-2 border border-border">
              <Select
                label="Plan"
                value={planForm.plan_id}
                onChange={e => setPlanForm(f => ({ ...f, plan_id: e.target.value }))}
              >
                <option value="">Select plan…</option>
                {availPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Max Clients (capacity)"
                  type="number"
                  min="1"
                  value={planForm.max_clients}
                  onChange={e => setPlanForm(f => ({ ...f, max_clients: e.target.value }))}
                  placeholder="e.g. 950"
                />
                <Input
                  label="Actual Clients (now)"
                  type="number"
                  min="0"
                  value={planForm.actual_clients}
                  onChange={e => setPlanForm(f => ({ ...f, actual_clients: e.target.value }))}
                  placeholder="e.g. 320"
                />
              </div>
              <p className="text-xs text-slate-600">
                Capacity = how many fit; Actual = how many you have now (drives true cost-per-client).
              </p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="primary" onClick={addPlan}>Add</Button>
                <Button size="sm" onClick={() => setShowAddPlan(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {ccPlans.map(cp => {
              const plan = plans.find(p => p.id === cp.plan_id)
              if (!plan) return null
              const result = getCostCenterPlanCost(cc.id, cp.plan_id)
              return (
                <div key={cp.id} className="flex items-center gap-2 bg-bg rounded-lg px-3 py-2 text-xs group">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 truncate">{plan.name}</p>
                    <p className="text-slate-600">
                      {fmtPct(result.weight * 100)} weight · <span className="text-warning">{fmtLYD(result.totalLYD)}</span> cost
                      {' · '}
                      <span className={result.occupancy >= 0.8 ? 'text-success' : result.occupancy >= 0.5 ? 'text-warning' : 'text-danger'}>
                        {fmtPct(result.occupancy * 100)} full
                      </span>
                      {result.actualClients > 0 && (
                        <> · <span className="text-primary">{fmtLYD(result.costPerActualClient)}</span>/client</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-600">max</span>
                      <input
                        type="number"
                        className="w-14 bg-card border border-border rounded px-1 py-0.5 text-xs text-slate-200 text-center focus:outline-none focus:border-primary"
                        value={cp.max_clients}
                        min="1"
                        onChange={e => updateCostCenterPlan(cp.id, { max_clients: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-600">now</span>
                      <input
                        type="number"
                        className="w-14 bg-card border border-border rounded px-1 py-0.5 text-xs text-primary text-center focus:outline-none focus:border-primary"
                        value={cp.actual_clients ?? 0}
                        min="0"
                        onChange={e => updateCostCenterPlan(cp.id, { actual_clients: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <button
                      onClick={() => { removeCostCenterPlan(cp.id); toast.success('Removed') }}
                      className="opacity-0 group-hover:opacity-100 text-danger hover:text-danger/80 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
            {ccPlans.length === 0 && (
              <p className="text-xs text-slate-600 italic px-1">No plans linked. Add plans with capacities.</p>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown toggle */}
      <div>
        <button
          onClick={() => setShowBreakdown(b => !b)}
          className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
        >
          <Calculator size={13} />
          {showBreakdown ? 'Hide' : 'Show'} Cost Allocation Analysis
          {showBreakdown ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showBreakdown && <CalcBreakdownCard ccId={cc.id} />}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CostCenters() {
  const { costCenters, addCostCenter, updateCostCenter, deleteCostCenter, planCategories, getPlanCat } = useAppStore()
  const catClass = (key) => colorClass(getPlanCat(key)?.color)
  const catLabel = (key) => getPlanCat(key)?.label || key
  const [form, setForm] = useState(emptyCC)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [expanded, setExpanded] = useState({})

  const openAdd = () => { setForm(emptyCC); setEditing(null); setShowModal(true) }
  const openEdit = (cc) => { setForm({ ...cc }); setEditing(cc.id); setShowModal(true) }

  const save = () => {
    if (!form.name.trim()) return toast.error('Name required')
    if (editing) { updateCostCenter(editing, form); toast.success('Cost center updated') }
    else { addCostCenter(form); toast.success('Cost center created') }
    setShowModal(false)
  }

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Cost Centers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Shared infrastructure pools — allocate costs to plans by client capacity
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          <Plus size={15} /> New Cost Center
        </Button>
      </div>

      {/* Explainer */}
      <Card className="p-4 flex gap-3 border-primary/30 bg-primary/5">
        <Info size={16} className="text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-slate-400 space-y-1">
          <p className="text-slate-300 font-medium">How Cost Centers Work</p>
          <p>
            A cost center represents a shared infrastructure resource (e.g. one server hosting multiple plans).
            Register all costs (server rent, licenses, bandwidth, labor) and link plans with their <strong className="text-slate-200">maximum client capacity</strong>.
          </p>
          <p>
            <strong className="text-slate-200">Shared costs</strong> are split by capacity weight:{' '}
            <span className="font-mono text-primary">plan_clients / total_clients</span>.{' '}
            <strong className="text-slate-200">Dedicated costs</strong> go 100% to one plan regardless of capacity.
          </p>
        </div>
      </Card>

      {/* Cost Center Cards */}
      <div className="space-y-4">
        {costCenters.map(cc => (
          <Card key={cc.id} className="overflow-hidden">
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-border/20 transition-colors"
              onClick={() => toggle(cc.id)}
            >
              <div className="p-2.5 rounded-xl bg-primary/15 text-primary">
                <Layers size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-slate-100">{cc.name}</p>
                  <Badge className={catClass(cc.category)}>
                    {catLabel(cc.category)}
                  </Badge>
                </div>
                {cc.description && <p className="text-xs text-slate-500 mt-0.5">{cc.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => { e.stopPropagation(); openEdit(cc) }}
                  className="p-1.5 rounded-lg hover:bg-primary/20 text-slate-400 hover:text-primary transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmId(cc.id) }}
                  className="p-1.5 rounded-lg hover:bg-danger/20 text-slate-400 hover:text-danger transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                {expanded[cc.id] ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
              </div>
            </div>
            {expanded[cc.id] && <CostCenterDetail cc={cc} />}
          </Card>
        ))}
        {costCenters.length === 0 && (
          <Card className="p-10 text-center">
            <Layers size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No cost centers yet</p>
            <p className="text-slate-600 text-sm mt-1">
              Create a cost center for shared hosting servers, VPS nodes, or any shared infrastructure.
            </p>
            <Button variant="primary" className="mt-4 mx-auto" onClick={openAdd}>
              <Plus size={15} /> Create First Cost Center
            </Button>
          </Card>
        )}
      </div>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Cost Center' : 'New Cost Center'}>
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Shared Hosting Server #1"
          />
          <Select
            label="Category"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          >
            {planCategories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
          <Textarea
            label="Description"
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe this infrastructure resource…"
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => { deleteCostCenter(confirmId); toast.success('Cost center deleted') }}
        title="Delete Cost Center"
        message="All component links and plan assignments will be removed. Plan costs from this center will be cleared."
      />
    </div>
  )
}
