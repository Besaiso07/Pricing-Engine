import useAppStore from '../store/appStore'
import { fmtLYD, fmtCurrency } from '../utils/format'

const billLabel = { monthly: '/ mo', yearly: '/ yr', one_time: 'once' }

// One-line working of a component's monthly LYD cost:
//   $250.00 / mo × 11.000 (parallel) × 1.05 buffer = 2887.500 LYD / mo
export function costFormulaParts(steps) {
  const parts = [`${fmtCurrency(steps.amount, steps.currency)} ${billLabel[steps.billing] || ''}`.trim()]
  if (steps.isForeign) {
    parts.push(`× ${steps.rate.toFixed(3)} (${steps.currency}→LYD ${steps.rateMode})`)
    if (steps.bufferPct) parts.push(`× ${(1 + steps.bufferPct / 100).toFixed(2)} buffer`)
  }
  if (steps.divisor !== 1) {
    parts.push(`= ${fmtLYD(steps.lydPerBill)} ${steps.billing === 'one_time' ? 'once' : '/ yr'}`)
    parts.push(`÷ ${steps.divisor} mo`)
  }
  if (steps.inflation !== 1) parts.push(`× ${steps.inflation.toFixed(4)} inflation`)
  parts.push(`= ${fmtLYD(steps.monthlyLYD)} / mo`)
  return parts
}

export default function CostFormula({ component, className = '' }) {
  const componentCostSteps = useAppStore(s => s.componentCostSteps)
  const parts = costFormulaParts(componentCostSteps(component))
  return (
    <div className={`text-[11px] text-slate-500 font-mono pl-1 ${className}`}>
      ↳ {parts.join(' ')}
    </div>
  )
}
