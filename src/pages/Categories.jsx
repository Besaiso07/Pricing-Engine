import { useState } from 'react'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { ConfirmModal } from '../components/ui/Modal'
import { PALETTE_KEYS, PALETTE_DOT, colorClass } from '../utils/format'
import { Plus, Pencil, Trash2, Check, X, Tag, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {PALETTE_KEYS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full ${PALETTE_DOT[c]} transition-transform ${value === c ? 'ring-2 ring-white ring-offset-2 ring-offset-card scale-110' : 'opacity-60 hover:opacity-100'}`}
          title={c}
        />
      ))}
    </div>
  )
}

function CategorySection({ title, subtitle, categories, usageFn, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('primary')
  const [editId, setEditId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('primary')
  const [confirmId, setConfirmId] = useState(null)

  const startEdit = (c) => { setEditId(c.id); setEditLabel(c.label); setEditColor(c.color) }
  const saveEdit = () => {
    if (!editLabel.trim()) return toast.error('Label required')
    onUpdate(editId, { label: editLabel.trim(), color: editColor })
    setEditId(null)
    toast.success('Category updated')
  }
  const add = () => {
    if (!newLabel.trim()) return toast.error('Label required')
    const ok = onAdd({ label: newLabel, color: newColor })
    if (!ok) return toast.error('A category with that name already exists')
    setNewLabel(''); setNewColor('primary'); setAdding(false)
    toast.success('Category added')
  }
  const remove = (id) => {
    const ok = onDelete(id)
    if (!ok) toast.error('Cannot delete — category is in use')
    else toast.success('Category deleted')
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Tag size={15} className="text-primary" /> {title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setAdding(!adding)}>
          <Plus size={13} /> Add
        </Button>
      </div>

      {adding && (
        <div className="bg-bg rounded-xl p-4 space-y-3 border border-border">
          <Input label="Category Name" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Backup Storage" />
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">Color</label>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={add}>Add Category</Button>
            <Button size="sm" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {categories.map(c => {
          const usage = usageFn(c.key)
          const isEditing = editId === c.id
          return (
            <div key={c.id} className="flex items-center gap-3 bg-bg rounded-lg px-3 py-2.5">
              {isEditing ? (
                <>
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <input
                    className="flex-1 bg-card border border-border rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-primary"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                  />
                  <button onClick={saveEdit} className="p-1.5 rounded-lg text-success hover:bg-success/20"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-border/50"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className={`w-3 h-3 rounded-full ${PALETTE_DOT[c.color]}`} />
                  <span className="text-sm text-slate-200 font-medium flex-1">{c.label}</span>
                  <span className="text-xs text-slate-600 font-mono">{c.key}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${usage > 0 ? colorClass(c.color) : 'text-slate-500 border-border'}`}>
                    {usage} in use
                  </span>
                  <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/20 transition-colors">
                    <Pencil size={13} />
                  </button>
                  {usage > 0 ? (
                    <span className="p-1.5 text-slate-700" title="In use — cannot delete"><Lock size={13} /></span>
                  ) : (
                    <button onClick={() => setConfirmId(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/20 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
        {categories.length === 0 && (
          <p className="text-xs text-slate-600 italic px-1">No categories yet.</p>
        )}
      </div>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => remove(confirmId)}
        title="Delete Category"
        message="This category will be permanently removed. (Only allowed when no records use it.)"
      />
    </Card>
  )
}

export default function Categories() {
  const {
    componentCategories, planCategories,
    componentCatUsage, planCatUsage,
    addComponentCategory, updateComponentCategory, deleteComponentCategory,
    addPlanCategory, updatePlanCategory, deletePlanCategory,
  } = useAppStore()

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Categories</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage the categories used to classify cost components and service plans.
          Categories in use cannot be deleted.
        </p>
      </div>

      <CategorySection
        title="Cost Component Categories"
        subtitle="Used in the Cost Components library (license, infrastructure, labor…)"
        categories={componentCategories}
        usageFn={componentCatUsage}
        onAdd={addComponentCategory}
        onUpdate={updateComponentCategory}
        onDelete={deleteComponentCategory}
      />

      <CategorySection
        title="Service Plan Categories"
        subtitle="Used for service plans and cost centers (shared hosting, VPS, dedicated…)"
        categories={planCategories}
        usageFn={planCatUsage}
        onAdd={addPlanCategory}
        onUpdate={updatePlanCategory}
        onDelete={deletePlanCategory}
      />
    </div>
  )
}
