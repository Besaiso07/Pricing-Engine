import { useState } from 'react'
import { Link } from 'react-router-dom'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal, { ConfirmModal } from '../components/ui/Modal'
import Input, { Select, Textarea } from '../components/ui/Input'
import ImportButton from '../components/ui/ImportButton'
import PrintPlanButton from '../components/PrintPlanButton'
import { fmtLYD, fmtPct, sellingPrice, marginPct, colorClass, statusColor, planCyclePrice } from '../utils/format'
import { BILLING_CYCLES, getCycle } from '../data/mockData'
import { Plus, ExternalLink, Trash2, LayoutGrid, List, Server, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const empty = { name: '', category: '', description: '', specs: '{}', markup_override_pct: '', current_price: '', billing_cycles: ['monthly'] }

const PLAN_TEMPLATE = `name,category,description,specs,markup_override_pct,current_price,status
Shared Hosting Starter,shared_hosting,Entry level plan,"{""disk"":""5GB"",""ram"":""1GB""}",35,25,active
VPS Basic,vps,Starter VPS,"{""cpu"":""1 vCPU"",""ram"":""1GB""}",,120,active`

function downloadTemplate(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function PlanCard({ plan, cost, price, margin, markup, catClass, catLabel }) {
  const cycles = plan.billing_cycles?.length ? plan.billing_cycles : ['monthly']
  const primaryCycle = cycles[0]
  const curPrice = planCyclePrice(plan, primaryCycle)
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-100 text-sm">{plan.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>
        </div>
        <Badge className={statusColor[plan.status]}>{plan.status}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge className={catClass(plan.category)}>{catLabel(plan.category)}</Badge>
        {Object.entries(plan.specs || {}).slice(0, 3).map(([k, v]) => (
          <span key={k} className="text-xs bg-border/50 text-slate-400 px-2 py-0.5 rounded-full">{v}</span>
        ))}
      </div>
      {/* Billing cycles offered */}
      <div className="flex flex-wrap gap-1">
        {cycles.map(c => (
          <span key={c} className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
            {getCycle(c).label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-bg rounded-lg p-2.5">
          <p className="text-xs text-slate-500">Break-Even{plan.isPerClient ? '/client' : ''}</p>
          <p className="text-sm font-bold font-mono text-warning">{fmtLYD(cost)}</p>
        </div>
        <div className="bg-bg rounded-lg p-2.5">
          <p className="text-xs text-slate-500">Suggested</p>
          <p className="text-sm font-bold font-mono text-success">{fmtLYD(price)}</p>
        </div>
        <div className="bg-bg rounded-lg p-2.5">
          <p className="text-xs text-slate-500">Current ({getCycle(primaryCycle).label})</p>
          <p className="text-sm font-bold font-mono text-primary">
            {curPrice != null ? fmtLYD(curPrice) : '—'}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Margin: <span className={`font-semibold ${margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-danger'}`}>{fmtPct(margin)}</span></span>
        <div className="flex gap-2">
          <PrintPlanButton planId={plan.id} />
          <Link to={`/plans/${plan.id}`}>
            <Button size="sm" variant="ghost">
              <ExternalLink size={12} /> Details
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}

export default function ServicePlans() {
  const { plans, addPlan, deletePlan, getPlanTotalCost, getSetting, importPlans, planCategories, getPlanCat } = useAppStore()
  const [view, setView] = useState('list')
  const [compareMode, setCompareMode] = useState('cycle') // 'cycle' | 'monthly'
  const [rowCycle, setRowCycle] = useState({}) // planId -> cycle key override
  const [form, setForm] = useState(empty)
  const [showModal, setShowModal] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const markupDefault = getSetting('default_markup_pct')

  const CATEGORIES = planCategories.map(c => c.key)
  const catClass = (key) => colorClass(getPlanCat(key)?.color)
  const catLabel = (key) => getPlanCat(key)?.label || key

  const openAdd = () => { setForm({ ...empty, category: CATEGORIES[0] || 'other' }); setShowModal(true) }
  const toggleCycle = (key) => setForm(f => ({
    ...f,
    billing_cycles: f.billing_cycles.includes(key)
      ? f.billing_cycles.filter(c => c !== key)
      : [...f.billing_cycles, key],
  }))

  const planData = plans.map(p => {
    const { totalLYD, unitLYD, isPerClient, clientCapacity } = getPlanTotalCost(p.id)
    const markup = p.markup_override_pct ?? markupDefault
    // price & margin are per client (unitLYD) so they compare correctly to the per-client price
    const price = sellingPrice(unitLYD, markup)
    const margin = marginPct(unitLYD, price)
    return { ...p, totalLYD, unitLYD, isPerClient, clientCapacity, price, margin, markup }
  })

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = planData.filter(p => p.category === cat)
    return acc
  }, {})

  // Compute a plan's figures in the cycle being viewed for the list
  const rowFigures = (p) => {
    const cycles = p.billing_cycles?.length ? p.billing_cycles : ['monthly']
    const selected = compareMode === 'monthly' ? 'monthly' : (rowCycle[p.id] || cycles[0])
    const months = getCycle(selected).months
    const breakEven = p.unitLYD * months
    const suggested = p.price * months
    const current = planCyclePrice(p, selected)
    const actualMargin = current != null ? marginPct(breakEven, current) : null
    return { cycles, selected, months, breakEven, suggested, current, actualMargin }
  }

  const save = () => {
    if (!form.name.trim()) return toast.error('Name required')
    let specs = {}
    try { specs = JSON.parse(form.specs || '{}') } catch { specs = {} }
    if (!form.billing_cycles?.length) return toast.error('Select at least one billing cycle')
    addPlan({
      ...form,
      specs,
      markup_override_pct: form.markup_override_pct ? parseFloat(form.markup_override_pct) : null,
      current_price: form.current_price ? parseFloat(form.current_price) : null,
      billing_cycles: form.billing_cycles,
    })
    toast.success('Plan created')
    setShowModal(false)
    setForm(empty)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Service Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">All sellable service offerings</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Compare mode (list view only) */}
          {view === 'list' && (
            <div className="flex rounded-lg border border-border overflow-hidden text-xs mr-1">
              <button
                onClick={() => setCompareMode('cycle')}
                className={`px-3 py-2 font-medium transition-colors ${compareMode === 'cycle' ? 'bg-primary text-bg' : 'text-slate-400 hover:bg-border/50'}`}
                title="Show each plan in its own billing cycle"
              >
                Each plan's cycle
              </button>
              <button
                onClick={() => setCompareMode('monthly')}
                className={`px-3 py-2 font-medium transition-colors ${compareMode === 'monthly' ? 'bg-primary text-bg' : 'text-slate-400 hover:bg-border/50'}`}
                title="Normalise every plan to a monthly figure for comparison"
              >
                Monthly equivalent
              </button>
            </div>
          )}
          <button onClick={() => setView('grid')} className={`p-2 rounded-lg border transition-colors ${view === 'grid' ? 'border-primary text-primary' : 'border-border text-slate-500'}`}><LayoutGrid size={15} /></button>
          <button onClick={() => setView('list')} className={`p-2 rounded-lg border transition-colors ${view === 'list' ? 'border-primary text-primary' : 'border-border text-slate-500'}`}><List size={15} /></button>
          <Button onClick={() => downloadTemplate(PLAN_TEMPLATE, 'plans-template.csv')}>
            <Download size={15} /> Template
          </Button>
          <ImportButton
            label="Import CSV"
            onRows={(rows) => {
              const n = importPlans(rows)
              toast.success(`Imported ${n} plan${n === 1 ? '' : 's'}`)
            }}
          />
          <Button variant="primary" onClick={openAdd}>
            <Plus size={15} /> New Plan
          </Button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="space-y-6">
          {CATEGORIES.map(cat => grouped[cat].length > 0 && (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-slate-400 mb-3">{catLabel(cat)}</h2>
              <div className="grid grid-cols-3 gap-4">
                {grouped[cat].map(p => (
                  <PlanCard key={p.id} plan={p} cost={p.unitLYD} price={p.price} margin={p.margin} markup={p.markup} catClass={catClass} catLabel={catLabel} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {compareMode === 'monthly'
              ? 'All plans normalised to a monthly figure for cost comparison.'
              : 'Each plan is shown in its own billing cycle. Use the cycle dropdown to switch a plan with multiple cycles. Margin shows "actual" when a current price is set for that cycle, otherwise the suggested margin.'}
          </p>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg/50">
              <tr className="text-xs text-slate-500 border-b border-border">
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Billing Cycle</th>
                <th className="text-right px-4 py-3 font-medium">Break-Even</th>
                <th className="text-right px-4 py-3 font-medium">Suggested</th>
                <th className="text-right px-4 py-3 font-medium">Current</th>
                <th className="text-right px-4 py-3 font-medium">Margin</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {planData.map(p => {
                const f = rowFigures(p)
                const marginVal = f.actualMargin ?? p.margin
                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-border/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-slate-200 font-medium">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.description}</p>
                    </td>
                    <td className="px-4 py-3"><Badge className={catClass(p.category)}>{catLabel(p.category)}</Badge></td>
                    <td className="px-4 py-3"><Badge className={statusColor[p.status]}>{p.status}</Badge></td>
                    <td className="px-4 py-3">
                      {compareMode === 'monthly' ? (
                        <span className="text-xs text-slate-500">Monthly equiv.</span>
                      ) : f.cycles.length > 1 ? (
                        <select
                          value={f.selected}
                          onChange={e => setRowCycle(rc => ({ ...rc, [p.id]: e.target.value }))}
                          className="bg-bg border border-border rounded-md px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-primary"
                        >
                          {f.cycles.map(c => <option key={c} value={c}>{getCycle(c).label}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-primary">{getCycle(f.selected).label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-warning">{fmtLYD(f.breakEven)}</td>
                    <td className="px-4 py-3 text-right font-mono text-success">{fmtLYD(f.suggested)}</td>
                    <td className="px-4 py-3 text-right font-mono text-primary">
                      {f.current != null ? fmtLYD(f.current) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={marginVal >= 30 ? 'text-success' : marginVal >= 15 ? 'text-warning' : 'text-danger'}>
                        {fmtPct(marginVal)}
                      </span>
                      {f.actualMargin != null && <span className="block text-[10px] text-slate-600">actual</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <PrintPlanButton planId={p.id} iconOnly />
                        <Link to={`/plans/${p.id}`}><Button size="sm"><ExternalLink size={12} /></Button></Link>
                        <button onClick={() => setConfirmId(p.id)} className="p-1.5 rounded-lg hover:bg-danger/20 text-slate-400 hover:text-danger transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
        </div>
      )}

      {plans.length === 0 && (
        <Card className="p-10 text-center">
          <Server size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No plans yet</p>
          <Button variant="primary" className="mt-4 mx-auto" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Create First Plan
          </Button>
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Service Plan">
        <div className="space-y-4">
          <Input label="Plan Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Shared Hosting – Starter" />
          <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
          </Select>

          {/* Billing cycles this plan is sold in */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">
              Billing Cycles Sold — break-even & pricing are shown for each selected cycle
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BILLING_CYCLES.map(c => {
                const active = form.billing_cycles.includes(c.key)
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleCycle(c.key)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      active ? 'bg-primary text-bg border-primary' : 'border-border text-slate-400 hover:bg-border/50'
                    }`}
                  >
                    {c.label}
                    <span className="block text-[10px] opacity-70">×{c.months} mo</span>
                  </button>
                )
              })}
            </div>
          </div>

          <Textarea label="Description" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Textarea
            label='Specs (JSON) — e.g. {"disk":"10GB","ram":"1GB"}'
            rows={2}
            value={form.specs}
            onChange={e => setForm(f => ({ ...f, specs: e.target.value }))}
          />
          <Input
            label="Markup Override % (optional)"
            type="number"
            step="1"
            value={form.markup_override_pct}
            onChange={e => setForm(f => ({ ...f, markup_override_pct: e.target.value }))}
            placeholder="default"
          />
          <p className="text-xs text-slate-600">
            💡 Set the actual selling price for each billing cycle later, in the plan's detail page
            (“Prices by Billing Cycle”).
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Create Plan</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => { deletePlan(confirmId); toast.success('Plan deleted') }}
        title="Delete Plan"
        message="This plan and all its cost allocations will be removed."
      />
    </div>
  )
}
