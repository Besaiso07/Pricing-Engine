import { Link } from 'react-router-dom'
import useAppStore from '../store/appStore'
import Card from '../components/ui/Card'
import { fmtLYD, fmtPct, sellingPrice, marginPct, planCyclePrice } from '../utils/format'
import { getCycle, SELL_CURRENCIES } from '../data/mockData'
import { useThemeHex, tooltipStyle } from '../utils/theme'
import { TrendingUp, Server, DollarSign, Percent, Activity, AlertTriangle, ExternalLink } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'


export default function Dashboard() {
  const { plans, getPlanTotalCost, getSetting, getSettingRaw, fxRate, planPriceMargins, planCyclePriceIn, components } = useAppStore()
  const t = useThemeHex()
  const COLORS = [t.primary, t.warning, t.success, t.purple, t.danger]

  const activePlans = plans.filter(p => p.status === 'active')
  const markupDefault = getSetting('default_markup_pct')

  // Compute costs for each plan
  const planData = plans.map(p => {
    const { totalLYD, unitLYD, isPerClient, isCosted, idleCostLYD } = getPlanTotalCost(p.id)
    const markup = p.markup_override_pct ?? markupDefault
    // per-client economics (comparable to the per-client selling price)
    const price = sellingPrice(unitLYD, markup)
    const margin = marginPct(unitLYD, price) // suggested margin (what the markup gives)
    // Margin at the plan's own prices, per cycle sold and currency (LYD/USD/EUR). Worst one drives alerts.
    const cycles = p.billing_cycles?.length ? p.billing_cycles : ['monthly']
    const cycleMargins = planPriceMargins(p)
    const worst = cycleMargins.reduce((w, c) => (w == null || c.margin < w.margin ? c : w), null)
    const unpricedCycles = cycles.filter(key => ['LYD', ...SELL_CURRENCIES].every(c => planCyclePriceIn(p, key, c) == null))
    return { ...p, totalLYD, unitLYD, isPerClient, isCosted, idleCostLYD, price, margin, markup, cycleMargins, worst, unpricedCycles }
  })

  const livePlans = planData.filter(p => p.status !== 'archived')
  const totalExposure = livePlans.reduce((s, p) => s + p.totalLYD, 0) // company-wide (all clients)
  const idleCost = livePlans.reduce((s, p) => s + p.idleCostLYD, 0)
  const uncostedCount = livePlans.filter(p => !p.isCosted).length

  // Avg margin at CURRENT prices: active, costed plans with a price (worst cycle each).
  const priced = planData.filter(p => p.status === 'active' && p.worst)
  const avgMargin = priced.length ? priced.reduce((s, p) => s + p.worst.margin, 0) / priced.length : null

  // ── Repricing alerts (per-client basis, every cycle sold) ──────────
  const targetMargin = getSetting('target_margin_pct')
  const alerts = []
  livePlans.forEach(p => {
    if (!p.isCosted) {
      alerts.push({ plan: p, type: 'uncosted', label: 'Uncosted — no costs linked', sev: 'danger', actualMargin: -1e9 })
      return
    }
    if (p.worst) {
      const { margin: m, key, currency } = p.worst
      const cyc = getCycle(key).label + (currency !== 'LYD' ? ` ${currency}` : '')
      if (m < 0) alerts.push({ plan: p, type: 'loss', label: `Loss-making ${cyc} (${fmtPct(m)})`, sev: 'danger', actualMargin: m })
      else if (m < targetMargin) alerts.push({ plan: p, type: 'below', label: `Below target ${cyc} (${fmtPct(m)})`, sev: 'warn', actualMargin: m })
    }
    if (p.unpricedCycles.length) {
      const names = p.unpricedCycles.map(k => getCycle(k).label).join(', ')
      alerts.push({ plan: p, type: 'no-price', label: `No price set: ${names}`, sev: 'warn' })
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

  // Margin range buckets — margin at current prices (worst cycle), costed + priced plans only
  const buckets = { '<0%': 0, '0-20%': 0, '20-40%': 0, '40-60%': 0, '60%+': 0 }
  livePlans.filter(p => p.worst).forEach(p => {
    const m = p.worst.margin
    if (m < 0) buckets['<0%']++
    else if (m < 20) buckets['0-20%']++
    else if (m < 40) buckets['20-40%']++
    else if (m < 60) buckets['40-60%']++
    else buckets['60%+']++
  })
  const barData = Object.entries(buckets).map(([range, count]) => ({ range, count }))

  const top5 = [...livePlans].filter(p => p.isCosted).sort((a, b) => b.totalLYD - a.totalLYD).slice(0, 5)

  // Show the rates actually used for costing (official or parallel per fx_mode)
  const fxMode = getSettingRaw('fx_mode') || 'official'
  const usdRate = fxRate('USD')
  const eurRate = fxRate('EUR')

  const kpis = [
    { label: 'Active Plans', value: activePlans.length, sub: `${plans.length} total`, icon: Server, color: 'text-primary' },
    { label: 'Monthly Cost Exposure', value: fmtLYD(totalExposure), sub: uncostedCount ? `${uncostedCount} plan${uncostedCount === 1 ? '' : 's'} uncosted — not included` : 'active + draft plans', icon: DollarSign, color: 'text-warning' },
    { label: 'Avg Margin at Current Prices', value: avgMargin == null ? '—' : fmtPct(avgMargin), sub: avgMargin == null ? 'no costed plan has a price yet' : `${priced.length} active plan${priced.length === 1 ? '' : 's'}, worst cycle each`, icon: Percent, color: 'text-success' },
    { label: 'Idle-Capacity Cost / mo', value: fmtLYD(idleCost), sub: 'pool cost today\'s clients don\'t cover', icon: Activity, color: 'text-danger' },
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
            <p className="text-xs text-slate-500">Costing at</p>
            <p className="text-sm font-bold text-slate-300 capitalize">{fxMode}</p>
          </div>
          <div className="w-px bg-border" />
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
        {kpis.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-border/50 ${color}`}>
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-bold text-slate-100">{value}</p>
              {sub && <p className="text-[11px] text-slate-500 truncate" title={sub}>{sub}</p>}
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
            {alerts.slice(0, 8).map(({ plan, label, sev, type }) => (
              <Link
                key={`${plan.id}-${type}`}
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
              <Tooltip contentStyle={tooltipStyle(t)} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: t.axis }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">Plans by Margin Range</h2>
          <p className="text-xs text-slate-500 mb-3">Margin at your current prices (worst billing cycle). Uncosted or unpriced plans excluded.</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="range" tick={{ fill: t.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: t.axis, fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle(t)} />
              <Bar dataKey="count" fill={t.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top 5 highest-cost plans */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-1">Top 5 Highest-Cost Plans</h2>
        <p className="text-xs text-slate-500 mb-4">Total = whole plan (all clients). Break-even/suggested price/margin are per client (÷ full capacity).</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-border">
              <th className="text-left pb-2 font-medium">Plan</th>
              <th className="text-left pb-2 font-medium">Category</th>
              <th className="text-right pb-2 font-medium">Total Cost / mo</th>
              <th className="text-right pb-2 font-medium">Break-Even / client</th>
              <th className="text-right pb-2 font-medium">Suggested / client</th>
              <th className="text-right pb-2 font-medium">Suggested Margin</th>
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
