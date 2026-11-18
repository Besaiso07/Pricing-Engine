import { useState } from 'react'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal, { ConfirmModal } from '../components/ui/Modal'
import Input, { Select, Textarea } from '../components/ui/Input'
import ImportButton from '../components/ui/ImportButton'
import { colorClass, fmtCurrency, fmtLYD } from '../utils/format'
import { Plus, Pencil, Trash2, Search, Filter, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const COMPONENT_TEMPLATE = `name,category,billing_cycle,cost_amount,currency,vendor,notes,amortize_months
cPanel License,license,monthly,20,USD,cPanel LLC,Per-server license,
Server Rack Unit,infrastructure,monthly,250,EUR,Dell,Shared hosting server,
Comodo SSL,license,yearly,120,USD,Comodo,Wildcard cert,
Server Setup Fee,other,one_time,500,USD,DC Provider,Spread over 24 months,24`

function downloadTemplate(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const CYCLES = ['monthly', 'yearly', 'one_time']
const CURRENCIES = ['USD', 'EUR', 'LYD']

const empty = { name: '', category: 'license', billing_cycle: 'monthly', cost_amount: '', currency: 'USD', vendor: '', notes: '', inflation_indexed: false, amortize_months: 24 }

export default function CostComponents() {
  const { components, addComponent, updateComponent, deleteComponent, monthlyComponentCost, importComponents, componentCategories, getComponentCat } = useAppStore()
  const CATEGORIES = componentCategories.map(c => c.key)
  const catClass = (key) => colorClass(getComponentCat(key)?.color)
  const catLabel = (key) => getComponentCat(key)?.label || key
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  const filtered = components.filter(c => {
    if (catFilter && c.category !== catFilter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const openAdd = () => { setForm({ ...empty, category: CATEGORIES[0] || 'other' }); setEditing(null); setShowModal(true) }
  const openEdit = (c) => { setForm({ ...empty, ...c }); setEditing(c.id); setShowModal(true) }

  const save = () => {
    if (!form.name.trim() || !form.cost_amount) return toast.error('Name and amount required')
    const data = {
      ...form,
      cost_amount: parseFloat(form.cost_amount),
      amortize_months: form.billing_cycle === 'one_time' ? (parseInt(form.amortize_months) || 24) : form.amortize_months,
    }
    if (editing) {
      updateComponent(editing, data)
      toast.success('Component updated')
    } else {
      addComponent(data)
      toast.success('Component added')
    }
    setShowModal(false)
  }

  const remove = (id) => {
    deleteComponent(id)
    toast.success('Component deleted')
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Cost Components</h1>
          <p className="text-sm text-slate-500 mt-0.5">Reusable cost building blocks</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => downloadTemplate(COMPONENT_TEMPLATE, 'components-template.csv')}>
            <Download size={15} /> Template
          </Button>
          <ImportButton
            label="Import CSV"
            onRows={(rows) => {
              const n = importComponents(rows)
              toast.success(`Imported ${n} component${n === 1 ? '' : 's'}`)
            }}
          />
          <Button variant="primary" onClick={openAdd} data-tour="component-add">
            <Plus size={15} /> Add Component
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-primary"
            placeholder="Search components…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden" data-tour="components-table">
        <table className="w-full text-sm">
          <thead className="bg-bg/50">
            <tr className="text-xs text-slate-500 border-b border-border">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Billing</th>
              <th className="text-right px-4 py-3 font-medium">Cost (Original)</th>
              <th className="text-right px-4 py-3 font-medium">Monthly (LYD)</th>
              <th className="text-left px-4 py-3 font-medium">Vendor</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const monthly = monthlyComponentCost(c)
              return (
                <tr key={c.id} className="border-b border-border/50 hover:bg-border/20 transition-colors">
                  <td className="px-4 py-3 text-slate-200 font-medium">
                    {c.name}
                    {c.inflation_indexed && (
                      <span className="ml-1.5 text-[10px] text-danger border border-danger/30 bg-danger/10 px-1 py-0.5 rounded" title="Indexed for inflation">↑ infl</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={catClass(c.category)}>{catLabel(c.category)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 capitalize">
                    {c.billing_cycle.replace('_', ' ')}
                    {c.billing_cycle === 'one_time' && (
                      <span className="block text-[10px] text-purple normal-case">÷ {c.amortize_months || 24} mo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {fmtCurrency(c.cost_amount, c.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-warning">{fmtLYD(monthly)}</td>
                  <td className="px-4 py-3 text-slate-500">{c.vendor || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${c.is_active ? 'bg-success' : 'bg-muted'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-primary/20 text-slate-400 hover:text-primary transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setConfirmId(c.id)} className="p-1.5 rounded-lg hover:bg-danger/20 text-slate-400 hover:text-danger transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-slate-500">No components found.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Component' : 'New Cost Component'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. cPanel License" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
            </Select>
            <Select label="Billing Cycle" value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
              {CYCLES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cost Amount" type="number" step="0.01" min="0" value={form.cost_amount} onChange={e => setForm(f => ({ ...f, cost_amount: e.target.value }))} />
            <Select label="Currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          {form.billing_cycle === 'one_time' && (
            <div>
              <Input
                label="Amortize over (months)"
                type="number"
                min="1"
                value={form.amortize_months}
                onChange={e => setForm(f => ({ ...f, amortize_months: e.target.value }))}
              />
              <p className="text-xs text-slate-500 mt-1">
                One-time costs are spread over this period: monthly cost = amount ÷ months (default 24).
              </p>
            </div>
          )}
          <Input label="Vendor (optional)" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
          <Textarea label="Notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <label className="flex items-start gap-2.5 bg-bg rounded-lg p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.inflation_indexed}
              onChange={e => setForm(f => ({ ...f, inflation_indexed: e.target.checked }))}
              className="mt-0.5"
            />
            <span className="text-xs text-slate-300">
              Index for inflation
              <span className="block text-slate-500">
                Auto-escalate this cost by the monthly inflation rate from Settings (recommended for LYD costs: labor, fuel, rent).
              </span>
            </span>
          </label>
          <div className="flex items-center gap-3 pt-2 justify-end">
            <Button onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save Component</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => remove(confirmId)}
        title="Delete Component"
        message="This component will be removed from all plans and cost centers. This cannot be undone."
      />
    </div>
  )
}
