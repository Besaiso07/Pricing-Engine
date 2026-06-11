import { Link } from 'react-router-dom'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import { fmtLYD, fmtPct, sellingPrice, marginPct, planCyclePrice } from '../utils/format'
import { TrendingUp, Server, DollarSign, Percent, Activity, AlertTriangle, ExternalLink } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'

const COLORS = ['#60a5fa', '#fbbf24', '#4ade80', '#a78bfa', '#f87171']

export default function Dashboard() {
  const { plans, getPlanTotalCost, getSetting, components } = useAppStore()

  const activePlans = plans.filter(p => p.status === 'active')
  const markupDefault = getSetting('default_markup_pct')

  // Compute costs for each plan
  const planData = plans.map(p => {
    const { totalLYD, unitLYD, isPerClient } = getPlanTotalCost(p.id)
    const markup = p.markup_override_pct ?? markupDefault
    // per-client economics (comparable to the per-client selling price)
    const price = sellingPrice(unitLYD, markup)
    const margin = marginPct(unitLYD, price)
    return { ...p, totalLYD, unitLYD, isPerClient, price, margin, markup }
  })

  const totalExposure = planData.reduce((s, p) => s + p.totalLYD, 0) // company-wide (all clients)
  const avgMargin = planData.filter(p => p.margin > 0).reduce((s, p, _, a) => s + p.margin / a.length, 0)

  // ── Repricing alerts (per-client basis) ──────────────────────────
  const targetMargin = getSetting('target_margin_pct')
  const alerts = []
  planData.forEach(p => {
    if (p.status === 'archived') return
    const monthlyPrice = planCyclePrice(p, 'monthly')
    if (p.unitLYD > 0 && monthlyPrice == null) {
      alerts.push({ plan: p, type: 'no-price', label: 'No selling price set', sev: 'warn' })
    } else if (monthlyPrice != null) {
      const actualMargin = marginPct(p.unitLYD, monthlyPrice)
      if (actualMargin < 0) alerts.push({ plan: p, type: 'loss', label: `Loss-making (${fmtPct(actualMargin)})`, sev: 'danger', actualMargin })
      else if (actualMargin < targetMargin) alerts.push({ plan: p, type: 'below', label: `Below target (${fmtPct(actualMargin)})`, sev: 'warn', actualMargin })
    }
  })
  alerts.sort((a, b) => (a.actualMargin ?? 999) - (b.actualMargin ?? 999))

  // Category breakdown
  const catMap = {}
  components.filter(c => c.is_active).forEach(c => {
    const key = c.category
    catMap[key] = (catMap[key] || 0) + 1
  })
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }))

  // Margin range buckets
  const buckets = { '0-20%': 0, '20-40%': 0, '40-60%': 0, '60%+': 0 }
  planData.forEach(p => {
    if (p.margin < 20) buckets['0-20%']++
    else if (p.margin < 40) buckets['20-40%']++
    else if (p.margin < 60) buckets['40-60%']++
    else buckets['60%+']++
  })
  const barData = Object.entries(buckets).map(([range, count]) => ({ range, count }))

  const top5 = [...planData].sort((a, b) => b.totalLYD - a.totalLYD).slice(0, 5)

  const usdRate = getSetting('usd_to_lyd')
  const eurRate = getSetting('eur_to_lyd')

  const kpis = [
    { label: 'Active Plans', value: activePlans.length, icon: Server, color: 'text-primary' },
    { label: 'Monthly Cost Exposure', value: fmtLYD(totalExposure), icon: DollarSign, color: 'text-warning' },
    { label: 'Avg Gross Margin', value: fmtPct(avgMargin), icon: Percent, color: 'text-success' },
    { label: 'Total Plans', value: plans.length, icon: Activity, color: 'text-purple' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pricing engine overview</p>
        </div>
        {/* Currency rates bar */}
        <div className="flex gap-4 bg-card border border-border rounded-xl px-4 py-2">
          <div className="text-center">
            <p className="text-xs text-slate-500">USD/LYD</p>
            <p className="text-sm font-bold text-primary">{usdRate.toFixed(3)}</p>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <p className="text-xs text-slate-500">EUR/LYD</p>
            <p className="text-sm font-bold text-warning">{eurRate.toFixed(3)}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-border/50 ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-bold text-slate-100">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Repricing alerts */}
      {alerts.length > 0 && (
        <Card className="p-5 border-warning/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <AlertTriangle size={15} className="text-warning" /> Repricing Alerts
              <span className="text-xs font-normal text-slate-500">— plans needing attention vs target {fmtPct(targetMargin)}</span>
            </h2>
            <Link to="/simulator"><span className="text-xs text-primary hover:underline">Open FX Simulator →</span></Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {alerts.slice(0, 8).map(({ plan, label, sev }) => (
              <Link
                key={plan.id}
                to={`/plans/${plan.id}`}
                className={`flex items-center justify-between rounded-lg px-3 py-2 border transition-colors hover:bg-border/30 ${
                  sev === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning/5'
                }`}
              >
                <span className="text-sm text-slate-200 font-medium truncate">{plan.name}</span>
                <span className={`text-xs font-medium ml-2 shrink-0 ${sev === 'danger' ? 'text-danger' : 'text-warning'}`}>{label}</span>
              </Link>
            ))}
          </div>
          {alerts.length > 8 && <p className="text-xs text-slate-500 mt-2">+{alerts.length - 8} more…</p>}
        </Card>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Components by Category</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#252a3d', border: '1px solid #2e3555', borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Plans by Margin Range</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e3555" />
              <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#252a3d', border: '1px solid #2e3555', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top 5 highest-cost plans */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-1">Top 5 Highest-Cost Plans</h2>
        <p className="text-xs text-slate-500 mb-4">Total = whole plan (all clients). Break-even/sell/margin are per client.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-border">
              <th className="text-left pb-2 font-medium">Plan</th>
              <th className="text-left pb-2 font-medium">Category</th>
              <th className="text-right pb-2 font-medium">Total Cost / mo</th>
              <th className="text-right pb-2 font-medium">Break-Even / client</th>
              <th className="text-right pb-2 font-medium">Sell / client</th>
              <th className="text-right pb-2 font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {top5.map((p, i) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 text-slate-200 font-medium">{p.name}</td>
                <td className="py-2.5 text-slate-400 capitalize">{p.category.replace('_', ' ')}</td>
                <td className="py-2.5 text-right text-slate-400 font-mono">{fmtLYD(p.totalLYD)}</td>
                <td className="py-2.5 text-right text-warning font-mono">{fmtLYD(p.unitLYD)}</td>
                <td className="py-2.5 text-right text-success font-mono">{fmtLYD(p.price)}</td>
                <td className="py-2.5 text-right">
                  <span className={`font-mono ${p.margin >= 30 ? 'text-success' : p.margin >= 15 ? 'text-warning' : 'text-danger'}`}>
                    {fmtPct(p.margin)}
                  </span>
                </td>
              </tr>
            ))}
            {top5.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">No plans with cost data yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
