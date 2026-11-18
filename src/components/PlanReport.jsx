import useAppStore from '../store/appStore'
import {
  fmtLYD, fmtCurrency, fmtPct, sellingPrice, marginPct, planCyclePrice,
} from '../utils/format'
import { BILLING_CYCLES, getCycle, sortCycles, defaultCycle, SELL_CURRENCIES } from '../data/mockData'

// A clean, light-themed, print-optimized one-page cost report for a single plan.
export default function PlanReport({ planId }) {
  const {
    plans, getPlanTotalCost, getSetting, getSettingRaw, getPlanCat, getComponentCat, componentCostSteps,
    fxRate, fromLYD, planCyclePriceIn, planCycleMarginIn,
  } = useAppStore()

  const plan = plans.find(p => p.id === planId)
  if (!plan) return null

  const {
    totalLYD, unitLYD, clientCapacity, clientActual, perClientCapacity, perClientActual,
    idleCostLYD, isCosted,
    isPerClient, directBreakdown, directTotal, ccContributions, ccTotal,
  } = getPlanTotalCost(planId)

  const markup = plan.markup_override_pct ?? getSetting('default_markup_pct')
  const suggestedUnit = sellingPrice(unitLYD, markup)
  const catLabel = getPlanCat(plan.category)?.label || plan.category
  const compCatLabel = (k) => getComponentCat(k)?.label || k

  const fxMode = getSettingRaw('fx_mode') || 'official'
  const usdRate = fxMode === 'parallel' ? getSetting('usd_to_lyd_parallel') : getSetting('usd_to_lyd')
  const eurRate = fxMode === 'parallel' ? getSetting('eur_to_lyd_parallel') : getSetting('eur_to_lyd')
  const buffer = getSetting('fx_buffer_pct')
  const inflation = getSetting('monthly_inflation_pct')

  const cycles = sortCycles(plan.billing_cycles)
  const mainCycle = defaultCycle(cycles)

  const generatedAt = new Date().toLocaleString()

  // ── light theme helpers (sized to fill an A4 page) ──
  const box = { border: '1px solid #e2e8f0', borderRadius: 8 }
  const th = { textAlign: 'left', padding: '9px 11px', background: '#f1f5f9', color: '#475569', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }
  const thR = { ...th, textAlign: 'right' }
  const td = { padding: '9px 11px', fontSize: 13, borderBottom: '1px solid #eef2f6', color: '#1e293b' }
  const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

  const Summary = ({ label, value, sub, accent }) => (
    <div style={{ ...box, padding: '14px 16px', background: '#f8fafc' }} className="pr-avoid-break">
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: accent || '#0f172a', fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
    </div>
  )

  // Vendor cost in its own currency, and the FX working that turns it into LYD
  const billSuffix = { monthly: '/mo', yearly: '/yr', one_time: ' once' }
  const VendorCells = ({ c }) => {
    const st = componentCostSteps(c)
    return (
      <>
        <td style={tdR}>{fmtCurrency(st.amount, st.currency)}{billSuffix[st.billing] || ''}</td>
        <td style={{ ...tdR, color: '#64748b' }}>
          {st.isForeign ? <>× {st.rate.toFixed(3)}{st.bufferPct ? <div style={{ fontSize: 10.5 }}>+{st.bufferPct}% buffer</div> : null}</> : '—'}
          {st.divisor !== 1 && <div style={{ fontSize: 10.5 }}>÷ {st.divisor} mo</div>}
        </td>
      </>
    )
  }

  return (
    <div id="print-area">
      <div style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#0f172a', padding: '0', width: '100%', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>

        {/* Brand header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1c2030', color: '#fff', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }} className="pr-avoid-break">
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.3 }}>Libyan Spider</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>PricingEngine · Plan Cost Report</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#cbd5e1', lineHeight: 1.7 }}>
            <div>Generated: {generatedAt}</div>
            <div>FX basis: <b style={{ color: '#fff' }}>{fxMode === 'parallel' ? 'Parallel/Market' : 'Official/CBL'}</b> · buffer {fmtPct(buffer)}</div>
            <div>All amounts in <b style={{ color: '#60a5fa' }}>LYD</b></div>
          </div>
        </div>

        {/* Plan title */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>{plan.name}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>{catLabel}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', textTransform: 'capitalize' }}>{plan.status}</span>
          </div>
          {plan.description && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{plan.description}</div>}
          {plan.specs && Object.keys(plan.specs).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {Object.entries(plan.specs).map(([k, v]) => (
                <span key={k} style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 5, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}>
                  <span style={{ color: '#94a3b8' }}>{k}:</span> {String(v)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Summary grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <Summary label="Total Monthly Cost (all clients)" value={fmtLYD(totalLYD)} accent="#b45309" />
          {isPerClient
            ? <Summary label="Clients (capacity / now)" value={`${clientCapacity} / ${clientActual}`} sub={clientCapacity ? `${fmtPct((clientActual / clientCapacity) * 100)} occupancy` : ''} />
            : <Summary label="Sold as" value="Single unit" sub="not per-client" />}
          <Summary label={isPerClient ? 'Cost / Client (at capacity)' : 'Break-Even / month'} value={isCosted ? fmtLYD(unitLYD) : 'Uncosted'} accent={isCosted ? '#b45309' : '#b91c1c'}
            sub={!isCosted ? 'no costs linked to this plan' : isPerClient && perClientActual != null ? `${fmtLYD(perClientActual)} at current fill` : ''} />
          <Summary label="Markup" value={fmtPct(markup)} />
          <Summary label="Suggested Price / Client (monthly)" value={fmtLYD(suggestedUnit)} accent="#15803d" />
          <Summary label={`Current Price (${getCycle(mainCycle).label})`} value={planCyclePrice(plan, mainCycle) != null ? fmtLYD(planCyclePrice(plan, mainCycle)) : '—'} accent="#1d4ed8" />
        </div>

        {/* Cost Allocation */}
        <div style={{ fontSize: 16, fontWeight: 700, margin: '6px 0 12px', paddingBottom: 6, borderBottom: '2px solid #e2e8f0' }}>1 · Cost Allocation <span style={{ fontWeight: 400, fontSize: 12, color: '#94a3b8' }}>(monthly)</span></div>

        {directBreakdown.length > 0 && (
          <div className="pr-avoid-break" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Direct allocations</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', ...box, overflow: 'hidden' }}>
              <thead>
                <tr>
                  <th style={th}>Component</th><th style={thR}>Vendor Cost</th><th style={thR}>FX Rate</th>
                  <th style={thR}>Cost / mo (LYD)</th><th style={thR}>Weight</th><th style={thR}>Allocated</th>
                </tr>
              </thead>
              <tbody>
                {directBreakdown.map(({ component: c, alloc, monthlyCostLYD, allocatedLYD }) => (
                  <tr key={alloc.id}>
                    <td style={td}>{c.name}<div style={{ fontSize: 10.5, color: '#94a3b8' }}>{compCatLabel(c.category)}</div></td>
                    <VendorCells c={c} />
                    <td style={tdR}>{fmtLYD(monthlyCostLYD)}</td>
                    <td style={tdR}>{fmtPct((alloc.allocation_weight || 0) * 100)}</td>
                    <td style={{ ...tdR, fontWeight: 600 }}>{fmtLYD(allocatedLYD)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...td, fontWeight: 700 }} colSpan={5}>Direct subtotal</td>
                  <td style={{ ...tdR, fontWeight: 700, color: '#b45309' }}>{fmtLYD(directTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {ccContributions.map(({ costCenter, breakdown, sharedTotal, dedicatedTotal, totalLYD: ccPlanTotal, weight, planClients, totalClients, actualClients, occupancy }) => (
          <div key={costCenter.id} className="pr-avoid-break" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Cost center: {costCenter.name}
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>
                {'  '}— this plan holds {planClients} of {totalClients} client slots ({fmtPct(weight * 100)} of pool)
                {actualClients ? ` · ${actualClients} active (${fmtPct(occupancy * 100)})` : ''}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', ...box, overflow: 'hidden' }}>
              <thead>
                <tr>
                  <th style={th}>Component</th><th style={thR}>Vendor Cost</th><th style={thR}>FX Rate</th>
                  <th style={thR}>Pool Cost / mo (LYD)</th><th style={thR}>Share</th><th style={thR}>Allocated</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map(({ component: c, type, monthlyCostLYD, allocatedLYD, weight: w }) => (
                  <tr key={c.id}>
                    <td style={td}>{c.name}<div style={{ fontSize: 10.5, color: '#94a3b8' }}>{type === 'dedicated' ? 'Dedicated' : 'Shared'}</div></td>
                    <VendorCells c={c} />
                    <td style={tdR}>{fmtLYD(monthlyCostLYD)}</td>
                    <td style={tdR}>{type === 'dedicated' ? '100%' : fmtPct(w * 100)}</td>
                    <td style={{ ...tdR, fontWeight: 600 }}>{fmtLYD(allocatedLYD)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...td, fontWeight: 700 }} colSpan={5}>
                    Subtotal (shared {fmtLYD(sharedTotal)} · dedicated {fmtLYD(dedicatedTotal)})
                  </td>
                  <td style={{ ...tdR, fontWeight: 700, color: '#b45309' }}>{fmtLYD(ccPlanTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {/* Totals */}
        <div className="pr-avoid-break" style={{ ...box, background: '#eff6ff', borderColor: '#bfdbfe', padding: '14px 16px', marginBottom: 24, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#475569' }}>
            <span>Direct + Cost Centers (all clients)</span>
            <b style={{ color: '#b45309' }}>{fmtLYD(totalLYD)} / mo</b>
          </div>
          {isPerClient && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#475569', marginTop: 4 }}>
              <span>÷ {clientCapacity} clients (capacity) = cost per client</span>
              <b style={{ color: '#b45309' }}>{fmtLYD(unitLYD)} / client</b>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#475569', marginTop: 4, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
            <span>× (1 + {fmtPct(markup)} markup) = suggested price per client</span>
            <b style={{ color: '#15803d' }}>{fmtLYD(suggestedUnit)} / mo</b>
          </div>
        </div>

        {/* Billing cycles & pricing */}
        <div style={{ fontSize: 16, fontWeight: 700, margin: '6px 0 12px', paddingBottom: 6, borderBottom: '2px solid #e2e8f0' }}>2 · Billing Cycles &amp; Pricing <span style={{ fontWeight: 400, fontSize: 12, color: '#94a3b8' }}>(per client)</span></div>
        <table className="pr-avoid-break" style={{ width: '100%', borderCollapse: 'collapse', ...box, overflow: 'hidden', marginBottom: 20 }}>
          <thead>
            <tr>
              <th style={th}>Billing Cycle</th><th style={thR}>Months</th>
              <th style={thR}>Break-Even</th><th style={thR}>Suggested</th>
              <th style={thR}>Current Price</th><th style={thR}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map(key => {
              const cyc = getCycle(key)
              const be = unitLYD * cyc.months
              const suggested = suggestedUnit * cyc.months
              const current = planCyclePrice(plan, key)
              const margin = !isCosted ? null : current != null ? marginPct(be, current) : marginPct(be, suggested)
              return (
                <tr key={key}>
                  <td style={{ ...td, fontWeight: 600 }}>{cyc.label}</td>
                  <td style={tdR}>×{cyc.months}</td>
                  <td style={tdR}>{fmtLYD(be)}</td>
                  <td style={{ ...tdR, color: '#15803d' }}>{fmtLYD(suggested)}</td>
                  <td style={{ ...tdR, color: '#1d4ed8', fontWeight: 600 }}>{current != null ? fmtLYD(current) : '—'}</td>
                  <td style={{ ...tdR, color: margin == null || margin < 0 ? '#b91c1c' : margin < 15 ? '#b45309' : '#15803d', fontWeight: 600 }}>{margin == null ? 'Uncosted' : fmtPct(margin)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Foreign-currency prices */}
        <div style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>
          Prices in {SELL_CURRENCIES.join(' / ')}
          <span style={{ fontWeight: 400, fontSize: 11, color: '#94a3b8' }}>
            {'  '}converted at the costing rate ({SELL_CURRENCIES.map(c => `${c} ${fxRate(c).toFixed(3)}`).join(', ')})
          </span>
        </div>
        <table className="pr-avoid-break" style={{ width: '100%', borderCollapse: 'collapse', ...box, overflow: 'hidden', marginBottom: 20 }}>
          <thead>
            <tr>
              <th style={th}>Billing Cycle</th><th style={th}>Currency</th>
              <th style={thR}>Break-Even</th><th style={thR}>Suggested</th>
              <th style={thR}>Your Price</th><th style={thR}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {cycles.flatMap(key => {
              const cyc = getCycle(key)
              return SELL_CURRENCIES.map(c => {
                const own = planCyclePriceIn(plan, key, c)
                const m = planCycleMarginIn(plan, key, c)
                return (
                  <tr key={key + c}>
                    <td style={{ ...td, fontWeight: 600 }}>{cyc.label}</td>
                    <td style={td}>{c}</td>
                    <td style={tdR}>{fmtCurrency(fromLYD(unitLYD * cyc.months, c), c)}</td>
                    <td style={{ ...tdR, color: '#15803d' }}>{fmtCurrency(fromLYD(suggestedUnit * cyc.months, c), c)}</td>
                    <td style={{ ...tdR, color: '#1d4ed8', fontWeight: 600 }}>{own != null ? fmtCurrency(own, c) : '—'}</td>
                    <td style={{ ...tdR, color: m == null ? '#94a3b8' : m < 0 ? '#b91c1c' : m < 15 ? '#b45309' : '#15803d', fontWeight: 600 }}>
                      {!isCosted ? 'Uncosted' : m == null ? '—' : fmtPct(m)}
                    </td>
                  </tr>
                )
              })
            })}
          </tbody>
        </table>

        {/* Assumptions footer */}
        <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', lineHeight: 1.7 }} className="pr-avoid-break">
          <b style={{ color: '#334155' }}>Assumptions:</b> Costs converted at the {fxMode === 'parallel' ? 'parallel/market' : 'official/CBL'} rate
          (USD {usdRate.toFixed(3)}, EUR {eurRate.toFixed(3)}) with a {fmtPct(buffer)} FX risk buffer.
          Monthly inflation on indexed costs: {fmtPct(inflation)}.
          {isPerClient
            ? ` Per-client figures use full client capacity.${idleCostLYD > 0 ? ` Idle-capacity cost not covered by today's clients: ${fmtLYD(idleCostLYD)} / mo.` : ''}`
            : ' This plan is priced as a single unit (no client capacity defined).'}
          {' '}Margin = (price − cost) ÷ price. Figures are management estimates, not a quote.
          <div style={{ marginTop: 4, color: '#94a3b8' }}>Confidential — Libyan Spider internal use.</div>
        </div>
      </div>
    </div>
  )
}
