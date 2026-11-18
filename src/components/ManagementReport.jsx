import { fmtLYD, fmtCurrency, fmtPct } from '../utils/format'

// Brief, light-themed, print-ready management report (screen preview + Print → Save as PDF).
// All figures come from the store's buildPlanReport(), computed at the REPORT's exchange rates.

const FLAG = {
  ok: { label: 'On target', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  below: { label: 'Below target', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  loss: { label: 'Loss', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  'no-price': { label: 'No price set', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  uncosted: { label: 'No costs linked', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
}

export default function ManagementReport({ report, meta, printId }) {
  const { rows, summary, target } = report
  const { title, note, rates, currency, buffer, fxModeLabel, generatedAt, cycleLabel } = meta
  const money = (n) => n == null ? '—' : currency === 'LYD' ? fmtLYD(n) : fmtCurrency(n, currency)
  const marginColor = (m) => m == null ? '#94a3b8' : m < 0 ? '#b91c1c' : m < target ? '#b45309' : '#15803d'

  // Group rows by category, keeping the selection order inside each group
  const groups = rows.reduce((acc, r) => { (acc[r.category] = acc[r.category] || []).push(r); return acc }, {})

  // Short auto-written key points (only facts from the data)
  const priced = rows.filter(r => r.margin != null)
  const best = priced.length ? priced.reduce((a, b) => (b.margin > a.margin ? b : a)) : null
  const worst = priced.length ? priced.reduce((a, b) => (b.margin < a.margin ? b : a)) : null
  const points = []
  if (priced.length) points.push(`${summary.ok} of ${priced.length} priced plan${priced.length === 1 ? '' : 's'} meet the ${fmtPct(target)} target margin.`)
  if (best && priced.length > 1) points.push(`Highest margin: ${best.plan.name} (${fmtPct(best.margin)}). Lowest: ${worst.plan.name} (${fmtPct(worst.margin)}).`)
  else if (best) points.push(`${best.plan.name}: margin ${fmtPct(best.margin)}.`)
  if (summary.loss) points.push(`${summary.loss} plan${summary.loss === 1 ? ' is' : 's are'} priced below cost and need${summary.loss === 1 ? 's' : ''} repricing.`)
  if (summary.noPrice) points.push(`${summary.noPrice} plan${summary.noPrice === 1 ? ' has' : 's have'} no selling price set for the reported cycle — see the suggested price.`)
  if (summary.uncosted) points.push(`${summary.uncosted} plan${summary.uncosted === 1 ? ' has' : 's have'} no costs linked and ${summary.uncosted === 1 ? 'is' : 'are'} excluded from margin figures.`)

  const box = { border: '1px solid #e2e8f0', borderRadius: 8 }
  const th = { textAlign: 'left', padding: '8px 10px', background: '#f1f5f9', color: '#475569', fontSize: 11.5, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }
  const thR = { ...th, textAlign: 'right' }
  const td = { padding: '8px 10px', fontSize: 12.5, borderBottom: '1px solid #eef2f6', color: '#1e293b', verticalAlign: 'top' }
  const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

  const Tile = ({ label, value, color }) => (
    <div style={{ ...box, padding: '10px 12px', background: '#f8fafc' }}>
      <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )

  const rateLine = Object.entries(rates).map(([c, r]) => `1 ${c} = ${Number(r).toFixed(3)} LYD`).join('  ·  ')

  return (
    <div id={printId}>
      <div style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#0f172a', background: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, background: '#1e3a8a', color: '#fff', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }} className="pr-avoid-break">
          <div>
            <div style={{ fontSize: 12, color: '#bfdbfe', fontWeight: 600, letterSpacing: 0.3 }}>LIBYAN SPIDER · PRICING ENGINE</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{title || 'Service Plan Pricing Report'}</div>
            <div style={{ fontSize: 11.5, color: '#bfdbfe', marginTop: 2 }}>{generatedAt}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11.5, lineHeight: 1.7, color: '#dbeafe' }}>
            <div style={{ fontSize: 10.5, color: '#93c5fd', fontWeight: 600 }}>EXCHANGE RATE USED</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{rateLine}</div>
            <div>Amounts in <b style={{ color: '#fff' }}>{currency}</b> · {cycleLabel}</div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }} className="pr-avoid-break">
          <Tile label="Plans in report" value={summary.plans} />
          <Tile label={`On target (≥ ${fmtPct(target)})`} value={summary.ok} color="#15803d" />
          <Tile label="Below target" value={summary.below} color={summary.below ? '#b45309' : undefined} />
          <Tile label="Loss-making" value={summary.loss} color={summary.loss ? '#b91c1c' : undefined} />
          <Tile label="Average margin" value={summary.avgMargin == null ? '—' : fmtPct(summary.avgMargin)} color={marginColor(summary.avgMargin)} />
        </div>

        {/* Key points + note */}
        {(points.length > 0 || note) && (
          <div style={{ display: 'grid', gridTemplateColumns: note ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 16 }} className="pr-avoid-break">
            {points.length > 0 && (
              <div style={{ ...box, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Key points</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                  {points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {note && (
              <div style={{ ...box, padding: '10px 14px', background: '#eff6ff', borderColor: '#bfdbfe' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#1e3a8a' }}>Note</div>
                <div style={{ fontSize: 12, color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note}</div>
              </div>
            )}
          </div>
        )}

        {/* Plans table */}
        {rows.length === 0 ? (
          <div style={{ ...box, padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No plans selected.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', ...box, overflow: 'hidden', marginBottom: 14 }}>
            <thead>
              <tr>
                <th style={th}>Plan</th>
                <th style={th}>Billing cycle</th>
                <th style={thR}>Cost / client</th>
                <th style={thR}>Suggested price</th>
                <th style={thR}>Current price</th>
                <th style={thR}>Margin</th>
                <th style={{ ...th, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([cat, list]) => [
                <tr key={`h-${cat}`}>
                  <td colSpan={7} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#1e3a8a', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.4 }}>{cat}</td>
                </tr>,
                ...list.map(r => {
                  const f = FLAG[r.flag]
                  return (
                    <tr key={r.plan.id} className="pr-avoid-break">
                      <td style={{ ...td, fontWeight: 600 }}>
                        {r.plan.name}
                        {r.isPerClient && <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 400 }}>shared · {r.clientCapacity} client capacity</div>}
                      </td>
                      <td style={td}>
                        {r.cycleLabel}
                        {!r.soldInCycle && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>not sold in this cycle</div>}
                      </td>
                      <td style={tdR}>{r.flag === 'uncosted' ? '—' : money(r.cost)}</td>
                      <td style={{ ...tdR, color: '#15803d' }}>
                        {r.flag === 'uncosted' ? '—' : money(r.suggested)}
                        {r.flag !== 'uncosted' && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>+{fmtPct(r.markup)} markup</div>}
                      </td>
                      <td style={{ ...tdR, color: '#1d4ed8', fontWeight: 600 }}>
                        {r.price == null ? '—' : money(r.price)}
                        {r.price != null && !r.priceExact && <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 400 }}>from {r.priceCur} price</div>}
                      </td>
                      <td style={{ ...tdR, color: marginColor(r.margin), fontWeight: 700 }}>{r.margin == null ? '—' : fmtPct(r.margin)}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99, color: f.color, background: f.bg, border: `1px solid ${f.border}`, whiteSpace: 'nowrap' }}>{f.label}</span>
                      </td>
                    </tr>
                  )
                }),
              ])}
            </tbody>
          </table>
        )}

        {/* Basis */}
        <div style={{ fontSize: 10.5, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6 }} className="pr-avoid-break">
          <b style={{ color: '#334155' }}>Basis:</b> Vendor costs in USD/EUR are converted at the report rate above
          ({fxModeLabel}) plus a {fmtPct(buffer)} FX risk buffer. Shared costs are split by client capacity; cost per client = plan share ÷ capacity.
          Suggested price = cost × (1 + markup). Margin = (price − cost) ÷ price, target {fmtPct(target)}.
          {currency !== 'LYD' && ` LYD amounts are shown in ${currency} at the report rate.`}
          <div style={{ marginTop: 4, color: '#94a3b8' }}>Confidential — Libyan Spider internal use.</div>
        </div>
      </div>
    </div>
  )
}
