import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input, { Textarea } from '../components/ui/Input'
import ManagementReport from '../components/ManagementReport'
import { colorClass } from '../utils/format'
import { BILLING_CYCLES } from '../data/mockData'
import { FileText, Download, RotateCcw, FileBarChart } from 'lucide-react'
import toast from 'react-hot-toast'

const CURRENCIES = ['LYD', 'USD', 'EUR']

export default function Reports() {
  const { plans, planCategories, getPlanCat, fxRate, getSetting, getSettingRaw, buildPlanReport } = useAppStore()

  // ── Plan selection ────────────────────────────────────────────
  const [scope, setScope] = useState('all') // 'all' | 'category' | 'custom'
  const [cats, setCats] = useState([])      // category keys (scope = category)
  const [picked, setPicked] = useState([])  // plan ids (scope = custom)
  const [activeOnly, setActiveOnly] = useState(true)

  // ── Report options ────────────────────────────────────────────
  const liveUsd = fxRate('USD'), liveEur = fxRate('EUR')
  const [usd, setUsd] = useState(liveUsd)
  const [eur, setEur] = useState(liveEur)
  const [cycleMode, setCycleMode] = useState('main')
  const [currency, setCurrency] = useState('LYD')
  const [title, setTitle] = useState('Service Plan Pricing Report')
  const [note, setNote] = useState('')
  const [printing, setPrinting] = useState(false)

  const pool = plans.filter(p => !activeOnly || p.status === 'active')
  const planIds = scope === 'all' ? pool.map(p => p.id)
    : scope === 'category' ? pool.filter(p => cats.includes(p.category)).map(p => p.id)
    : pool.filter(p => picked.includes(p.id)).map(p => p.id)

  const rates = { USD: parseFloat(usd) || 0, EUR: parseFloat(eur) || 0 }
  const report = buildPlanReport({ planIds, rates, cycleMode, currency })
  const fxMode = getSettingRaw('fx_mode') || 'official'
  const rateIsCustom = Math.abs(rates.USD - liveUsd) > 1e-9 || Math.abs(rates.EUR - liveEur) > 1e-9
  const generatedAt = useMemo(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), [])
  const meta = {
    title, note, rates, currency, generatedAt,
    buffer: getSetting('fx_buffer_pct'),
    fxModeLabel: rateIsCustom ? 'rate set for this report' : `current ${fxMode} rate`,
    cycleLabel: cycleMode === 'main' ? "each plan's main billing cycle" : `${BILLING_CYCLES.find(c => c.key === cycleMode)?.label} prices`,
  }

  // Print → Save as PDF (same mechanism as the single-plan PDF)
  useEffect(() => {
    if (!printing) return
    const oldTitle = document.title
    document.title = `${title || 'Pricing Report'} ${new Date().toISOString().slice(0, 10)}`
    const done = () => { setPrinting(false); document.title = oldTitle }
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => window.print(), 200)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); document.title = oldTitle }
  }, [printing]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const n = (v, d) => v == null ? '' : Number(v).toFixed(d)
    const dp = currency === 'LYD' ? 3 : 2
    const lines = [
      [q(title)], [q(`Generated ${generatedAt}`)],
      [q(`Exchange rate: 1 USD = ${rates.USD} LYD; 1 EUR = ${rates.EUR} LYD`)], [q(`Amounts in ${currency}`)], [],
      ['Plan', 'Category', 'Billing cycle', `Cost per client (${currency})`, `Suggested price (${currency})`, `Current price (${currency})`, 'Margin %', 'Status'].map(q),
      ...report.rows.map(r => [
        q(r.plan.name), q(r.category), q(r.cycleLabel),
        r.flag === 'uncosted' ? '' : n(r.cost, dp), r.flag === 'uncosted' ? '' : n(r.suggested, dp),
        n(r.price, dp), n(r.margin, 1), q(r.flag),
      ]),
    ]
    const blob = new Blob(['﻿' + lines.map(l => l.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'pricing-report').replace(/[^\w-]+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded')
  }

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  const seg = (active) => `px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-primary text-bg' : 'text-slate-400 hover:bg-border/50'}`

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><FileBarChart size={20} className="text-primary" /> Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Brief pricing report for management — pick plans, set the exchange rate, share as PDF.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCsv} disabled={!planIds.length}><Download size={15} /> CSV</Button>
          <Button variant="primary" onClick={() => setPrinting(true)} disabled={!planIds.length} data-tour="report-print"><FileText size={15} /> Print / Save PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5 items-start">
        {/* ── Controls ── */}
        <div className="space-y-4" data-tour="report-controls">
          <Card className="p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-200">1 · Plans</p>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button className={`flex-1 ${seg(scope === 'all')}`} onClick={() => setScope('all')}>All</button>
              <button className={`flex-1 ${seg(scope === 'category')}`} onClick={() => setScope('category')}>By category</button>
              <button className={`flex-1 ${seg(scope === 'custom')}`} onClick={() => setScope('custom')}>Select plans</button>
            </div>

            {scope === 'category' && (
              <div className="flex flex-wrap gap-1.5">
                {planCategories.map(c => {
                  const on = cats.includes(c.key)
                  const n = pool.filter(p => p.category === c.key).length
                  return (
                    <button key={c.key} onClick={() => toggle(cats, setCats, c.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? colorClass(c.color) : 'border-border text-slate-500 hover:bg-border/50'}`}>
                      {c.label} <span className="opacity-60">{n}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {scope === 'custom' && (
              <div className="max-h-64 overflow-auto rounded-lg border border-border divide-y divide-border">
                {pool.length === 0 && <p className="p-3 text-xs text-slate-500">No plans.</p>}
                {pool.map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-border/30">
                    <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(picked, setPicked, p.id)} className="accent-primary" />
                    <span className="text-slate-200 flex-1 truncate">{p.name}</span>
                    <span className="text-[11px] text-slate-500">{getPlanCat(p.category)?.label || p.category}</span>
                  </label>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="accent-primary" />
              Active plans only
            </label>
            <p className="text-xs text-slate-500">{planIds.length} plan{planIds.length === 1 ? '' : 's'} in the report</p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200">2 · Exchange rate for this report</p>
              {rateIsCustom && (
                <button onClick={() => { setUsd(liveUsd); setEur(liveEur) }} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <RotateCcw size={11} /> current
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="1 USD = … LYD" type="number" step="0.001" min="0" value={usd} onChange={e => setUsd(e.target.value)} />
              <Input label="1 EUR = … LYD" type="number" step="0.001" min="0" value={eur} onChange={e => setEur(e.target.value)} />
            </div>
            <p className="text-xs text-slate-500">
              All costs and prices in the report are recalculated at this rate and the rate is printed on the report.
              Your settings are not changed. Current {fxMode} rate: USD {liveUsd.toFixed(3)} · EUR {liveEur.toFixed(3)}.
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-200">3 · Layout</p>
            <div>
              <p className="text-xs text-slate-400 font-medium mb-1.5">Billing cycle shown</p>
              <select value={cycleMode} onChange={e => setCycleMode(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary">
                <option value="main">Each plan's main cycle</option>
                {BILLING_CYCLES.map(c => <option key={c.key} value={c.key}>{c.label} (all plans)</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium mb-1.5">Show amounts in</p>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {CURRENCIES.map(c => <button key={c} className={`flex-1 ${seg(currency === c)}`} onClick={() => setCurrency(c)}>{c}</button>)}
              </div>
            </div>
            <Input label="Report title" value={title} onChange={e => setTitle(e.target.value)} />
            <Textarea label="Note for management (optional)" rows={3} value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Proposed price review for Q1 — rates as of today's market." />
          </Card>
        </div>

        {/* ── Live preview ── */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm overflow-x-auto">
          <div className="min-w-[760px]">
            <ManagementReport report={report} meta={meta} />
          </div>
        </div>
      </div>

      {printing && createPortal(<ManagementReport report={report} meta={meta} printId="print-area" />, document.body)}
    </div>
  )
}
