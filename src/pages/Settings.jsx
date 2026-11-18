import { useState } from 'react'
import useAppStore from '../store/appStore'
import { useThemeHex, tooltipStyle } from '../utils/theme'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input, { Select } from '../components/ui/Input'
import { ConfirmModal } from '../components/ui/Modal'
import { useRef } from 'react'
import { Save, RefreshCw, Database, RotateCcw, TrendingUp, ShieldAlert, Download, Upload, History, Cloud, CloudOff } from 'lucide-react'
import { fmtPct } from '../utils/format'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { isCloudEnabled } from '../lib/supabase'
import { pushNow, pullNow } from '../lib/cloudSync'
import toast from 'react-hot-toast'

const RATE_LABELS = {
  usd_to_lyd: 'USD Official',
  eur_to_lyd: 'EUR Official',
  usd_to_lyd_parallel: 'USD Parallel',
  eur_to_lyd_parallel: 'EUR Parallel',
  fx_mode: 'Costing mode',
  fx_buffer_pct: 'FX buffer %',
}
const RATE_CHART_KEYS = ['usd_to_lyd', 'eur_to_lyd', 'usd_to_lyd_parallel', 'eur_to_lyd_parallel']
// theme token per rate line (hex resolved per theme in the component)
const RATE_COLORS = {
  usd_to_lyd: 'success',
  eur_to_lyd: 'primary',
  usd_to_lyd_parallel: 'warning',
  eur_to_lyd_parallel: 'purple',
}

const NUM_FIELDS = [
  'usd_to_lyd', 'eur_to_lyd', 'usd_to_lyd_parallel', 'eur_to_lyd_parallel',
  'fx_buffer_pct', 'monthly_inflation_pct', 'default_markup_pct', 'target_margin_pct',
]

export default function Settings() {
  const { settings, updateSetting, resetData, getSettingRaw, exportData, importData, rateHistory, cloudStatus, cloudLastSync, cloudError } = useAppStore()
  const t = useThemeHex()

  // chart data: one point per recorded rate change, oldest → newest
  const chartData = [...(rateHistory || [])]
    .filter(h => RATE_CHART_KEYS.includes(h.key))
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .map(h => ({
      at: new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      [h.key]: parseFloat(h.to),
    }))
  const fileRef = useRef(null)

  const doExport = () => {
    const payload = exportData()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    a.href = url
    a.download = `pricing-engine-backup-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup downloaded')
  }

  const doImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result)
        const ok = importData(payload, 'replace')
        if (ok) toast.success('Backup restored successfully')
        else toast.error('Invalid backup file')
      } catch {
        toast.error('Could not read backup file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  const [vals, setVals] = useState(() => {
    const o = {}
    NUM_FIELDS.forEach(k => { o[k] = getSettingRaw(k) })
    o.fx_mode = getSettingRaw('fx_mode') || 'official'
    return o
  })
  const [confirmReset, setConfirmReset] = useState(false)

  const set = (k, v) => setVals(s => ({ ...s, [k]: v }))

  const save = () => {
    NUM_FIELDS.forEach(k => updateSetting(k, vals[k]))
    updateSetting('fx_mode', vals.fx_mode)
    toast.success('Settings saved — all plan costs updated')
  }

  // live spread preview
  const usdSpread = vals.usd_to_lyd_parallel && vals.usd_to_lyd
    ? ((parseFloat(vals.usd_to_lyd_parallel) / parseFloat(vals.usd_to_lyd) - 1) * 100)
    : 0
  const eurSpread = vals.eur_to_lyd_parallel && vals.eur_to_lyd
    ? ((parseFloat(vals.eur_to_lyd_parallel) / parseFloat(vals.eur_to_lyd) - 1) * 100)
    : 0

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Master Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Exchange rates, FX risk, inflation and pricing defaults</p>
      </div>

      {/* FX rates — dual */}
      <Card className="p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <RefreshCw size={15} className="text-primary" /> Exchange Rates (Dual)
        </h2>

        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-success uppercase tracking-wide">Official (CBL)</p>
            <Input label="USD → LYD" type="number" step="0.001" min="0" value={vals.usd_to_lyd} onChange={e => set('usd_to_lyd', e.target.value)} />
            <Input label="EUR → LYD" type="number" step="0.001" min="0" value={vals.eur_to_lyd} onChange={e => set('eur_to_lyd', e.target.value)} />
          </div>
          <div className="space-y-4" data-tour="fx-parallel">
            <p className="text-xs font-semibold text-warning uppercase tracking-wide">Parallel (Market)</p>
            <Input label="USD → LYD" type="number" step="0.001" min="0" value={vals.usd_to_lyd_parallel} onChange={e => set('usd_to_lyd_parallel', e.target.value)} />
            <Input label="EUR → LYD" type="number" step="0.001" min="0" value={vals.eur_to_lyd_parallel} onChange={e => set('eur_to_lyd_parallel', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-4 text-xs">
          <span className="text-slate-500">USD spread: <span className="font-mono text-warning">{usdSpread.toFixed(1)}%</span></span>
          <span className="text-slate-500">EUR spread: <span className="font-mono text-warning">{eurSpread.toFixed(1)}%</span></span>
        </div>

        <div className="bg-bg rounded-xl p-4 flex items-center justify-between" data-tour="fx-mode">
          <div>
            <p className="text-xs font-medium text-slate-300">Rate used for costing</p>
            <p className="text-xs text-slate-500">Which rate drives all break-even calculations.</p>
          </div>
          <Select value={vals.fx_mode} onChange={e => set('fx_mode', e.target.value)} className="w-40">
            <option value="official">Official (CBL)</option>
            <option value="parallel">Parallel (Market)</option>
          </Select>
        </div>
      </Card>

      {/* Rate history */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <History size={15} className="text-warning" /> Exchange Rate History
        </h2>
        <p className="text-xs text-slate-500">
          Every rate, mode and buffer change is recorded here, so you can answer “what rate were we costing at in March?”
        </p>

        {chartData.length >= 2 && (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="at" tick={{ fill: t.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: t.axis, fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle(t)} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: t.axis }} />
              {RATE_CHART_KEYS.map(k => (
                <Line key={k} type="stepAfter" dataKey={k} name={RATE_LABELS[k]} stroke={t[RATE_COLORS[k]]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {(rateHistory || []).length === 0 ? (
          <p className="text-xs text-slate-600 italic">
            No changes recorded yet — history starts the next time you save a new rate.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto border border-border rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-bg/80 sticky top-0">
                <tr className="text-slate-500 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Rate</th>
                  <th className="text-right px-3 py-2 font-medium">From</th>
                  <th className="text-right px-3 py-2 font-medium">To</th>
                  <th className="text-right px-3 py-2 font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {rateHistory.map(h => {
                  const from = parseFloat(h.from)
                  const to = parseFloat(h.to)
                  const numeric = !isNaN(from) && !isNaN(to) && h.key !== 'fx_mode'
                  const delta = numeric && from !== 0 ? ((to - from) / from) * 100 : null
                  return (
                    <tr key={h.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 text-slate-400">{new Date(h.at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-200 font-medium">{RATE_LABELS[h.key] || h.key}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">{h.from ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-200">{h.to}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {delta != null ? (
                          <span className={delta > 0 ? 'text-danger' : delta < 0 ? 'text-success' : 'text-slate-500'}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* FX buffer + inflation */}
      <Card className="p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <ShieldAlert size={15} className="text-danger" /> Risk & Inflation
        </h2>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Input label="FX Risk Buffer %" type="number" step="0.5" min="0" value={vals.fx_buffer_pct} onChange={e => set('fx_buffer_pct', e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">Adds a cushion on foreign-currency costs to absorb dinar moves between price reviews.</p>
          </div>
          <div>
            <Input label="Monthly Inflation % (LYD costs)" type="number" step="0.1" min="0" value={vals.monthly_inflation_pct} onChange={e => set('monthly_inflation_pct', e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">Auto-escalates components flagged “index for inflation”. ≈{(Math.pow(1 + (parseFloat(vals.monthly_inflation_pct) || 0) / 100, 12) * 100 - 100).toFixed(1)}% per year.</p>
          </div>
        </div>
      </Card>

      {/* Pricing defaults */}
      <Card className="p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <TrendingUp size={15} className="text-success" /> Pricing & Targets
        </h2>
        <div className="grid grid-cols-2 gap-5">
          <Input label="Default Markup %" type="number" step="1" min="0" max="500" value={vals.default_markup_pct} onChange={e => set('default_markup_pct', e.target.value)} />
          <Input label="Target Margin % (alerts)" type="number" step="1" min="0" max="100" value={vals.target_margin_pct} onChange={e => set('target_margin_pct', e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">
          Selling price = Break-Even × (1 + Markup%). Plans below the target margin are flagged on the Dashboard.
        </p>

      </Card>

      <div className="flex justify-end">
        <Button variant="primary" onClick={save} data-tour="settings-save">
          <Save size={15} /> Save Settings
        </Button>
      </div>

      {/* Cloud Sync (Supabase) */}
      <Card className={`p-6 space-y-4 ${isCloudEnabled ? 'border-success/40' : 'border-border'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            {isCloudEnabled ? <Cloud size={15} className="text-success" /> : <CloudOff size={15} className="text-slate-500" />}
            Cloud Database (Supabase)
          </h2>
          {isCloudEnabled && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              cloudStatus === 'synced' ? 'text-success bg-success/10 border-success/30'
              : cloudStatus === 'saving' || cloudStatus === 'connecting' ? 'text-warning bg-warning/10 border-warning/30'
              : cloudStatus === 'error' ? 'text-danger bg-danger/10 border-danger/30'
              : 'text-slate-400 border-border'
            }`}>
              {cloudStatus === 'synced' ? 'Synced'
                : cloudStatus === 'saving' ? 'Saving…'
                : cloudStatus === 'connecting' ? 'Connecting…'
                : cloudStatus === 'error' ? 'Error'
                : cloudStatus}
            </span>
          )}
        </div>

        {isCloudEnabled ? (
          <>
            <p className="text-xs text-slate-400">
              Your data is stored in a real cloud database and syncs automatically on every change —
              safe across devices, browsers and refreshes. localStorage is kept as an offline cache.
            </p>
            {cloudLastSync && (
              <p className="text-xs text-slate-500">Last synced: {new Date(cloudLastSync).toLocaleString()}</p>
            )}
            {cloudStatus === 'error' && cloudError && (
              <p className="text-xs text-danger">Error: {cloudError}</p>
            )}
            <div className="flex gap-3">
              <Button variant="primary" onClick={async () => { await pushNow(); toast.success('Saved to cloud') }}>
                <Upload size={14} /> Save to cloud now
              </Button>
              <Button onClick={async () => { const ok = await pullNow(); toast.success(ok ? 'Loaded from cloud' : 'Cloud is empty') }}>
                <RefreshCw size={14} /> Pull from cloud
              </Button>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-400 space-y-2">
            <p>
              Not connected. Add your Supabase credentials to a <code className="text-primary">.env</code> file in the project root,
              then restart the dev server. See <code className="text-primary">SUPABASE_SETUP.md</code> for the 5-minute setup.
            </p>
            <pre className="bg-bg rounded-lg p-3 text-[11px] text-slate-300 overflow-x-auto border border-border">VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key</pre>
            <p className="text-slate-500">Until then, the app keeps working on local storage as before.</p>
          </div>
        )}
      </Card>

      {/* Backup & Restore */}
      <Card className="p-6 space-y-4 border-primary/30">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Download size={15} className="text-primary" /> Backup & Restore
        </h2>
        <p className="text-xs text-slate-400">
          Browser storage is tied to this exact address and can be lost (clearing cache, a different browser, or a changed port).
          <strong className="text-slate-300"> Export a backup file regularly</strong> — you can restore it anytime, anywhere.
        </p>
        <div className="flex items-center justify-between bg-bg rounded-xl p-4">
          <div className="text-xs">
            <p className="text-slate-300 font-medium">Export all data</p>
            <p className="text-slate-500">Downloads a .json file with every component, plan, cost center and setting.</p>
          </div>
          <Button variant="primary" onClick={doExport}><Download size={14} /> Export Backup</Button>
        </div>
        <div className="flex items-center justify-between bg-bg rounded-xl p-4">
          <div className="text-xs">
            <p className="text-slate-300 font-medium">Restore from backup</p>
            <p className="text-slate-500">Replaces current data with the contents of a backup file.</p>
          </div>
          <Button onClick={() => fileRef.current?.click()}><Upload size={14} /> Restore</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={doImport} className="hidden" />
        </div>
      </Card>

      {/* Data persistence */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Database size={15} className="text-success" /> Data Storage
        </h2>
        <div className="text-xs text-slate-400 space-y-1">
          <p className="text-slate-300 font-medium">Your data is saved automatically</p>
          <p>All components, cost centers, plans and settings persist in your browser. Nothing is sent to a server.</p>
        </div>
        <div className="flex items-center justify-between bg-bg rounded-xl p-4">
          <div className="text-xs">
            <p className="text-slate-300 font-medium">Reset to demo data</p>
            <p className="text-slate-500">Replaces all data with the original seeded examples.</p>
          </div>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} /> Reset Data
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { resetData(); toast.success('Data reset to demo defaults') }}
        title="Reset All Data"
        message="This replaces all your components, plans, cost centers and allocations with the original demo data. This cannot be undone."
      />
    </div>
  )
}
