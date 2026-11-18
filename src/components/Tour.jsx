import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAppStore from '../store/appStore'
import { X, ArrowLeft, ArrowRight, Compass } from 'lucide-react'

// ── Guided tour ─────────────────────────────────────────────────────
// A light, dependency-free walkthrough. Each step can navigate to a page and spotlight an element
// marked with data-tour="…". It only explains — it never creates or changes data.
// Opens once automatically for a new user (tourSeen), and anytime from "Guided tour" in the sidebar.

const firstPlanRoute = (s) => {
  const p = s.plans.find(x => x.status === 'active') || s.plans[0]
  return p ? `/plans/${p.id}` : null
}

const STEPS = [
  {
    title: 'Welcome to PricingEngine 👋',
    body: 'This tool works out what each of your services really costs in LYD and recommends a selling price. In a few short steps you\'ll see how: set the exchange rate → add your costs → create a plan → link the costs to it → share a report. The tour changes nothing — follow along or just click Next.',
  },
  {
    route: '/settings', target: 'fx-parallel',
    title: '1 · Set the market exchange rate',
    body: 'Your vendors bill in USD or EUR, but you sell in LYD. Enter today\'s market (parallel) rate here — for example 1 USD = 11.000 LYD.',
  },
  {
    route: '/settings', target: 'fx-mode',
    title: 'Choose the rate used for costing',
    body: 'Select "Parallel (Market)" so every vendor cost is converted at the market rate. The FX risk buffer further down adds a safety margin for dinar movements.',
  },
  {
    route: '/settings', target: 'settings-save',
    title: 'Save',
    body: 'Click Save Settings. Every plan\'s cost and suggested price updates immediately.',
  },
  {
    route: '/components', target: 'component-add',
    title: '2 · Add your cost components',
    body: 'Add each thing you pay a vendor for, in the vendor\'s currency. Try two: "Server Rent" — 250 USD, monthly (Infrastructure), and "cPanel License" — 20 USD, monthly (License).',
  },
  {
    route: '/components', target: 'components-table',
    title: 'Your costs, converted to LYD',
    body: 'Each component shows its original amount and its monthly cost in LYD at your rate. Yearly costs are divided by 12; one-time costs are spread over months.',
  },
  {
    route: '/plans', target: 'plan-new',
    title: '3 · Create a service plan',
    body: 'Click New Plan — e.g. "Shared Hosting – Starter". Choose its category and the billing cycles you sell it in (Monthly, Annually…).',
  },
  {
    route: '/plans', target: 'plans-table',
    title: 'Open the plan',
    body: 'Click any plan in the list to open its page. That\'s where you link costs and set prices.',
  },
  {
    route: firstPlanRoute, target: 'plan-direct',
    title: '4 · Allocate the two costs to the plan',
    body: 'Click Add Component, pick "Server Rent" with weight 1 (= 100%), then do the same for "cPanel License". A weight of 0.5 would charge half of that cost to this plan. Tip: for a cost shared by many plans (one server for hundreds of clients) use a Cost Center — it splits the cost by client capacity.',
    missing: 'Create a plan first — this step then shows where to link its costs.',
  },
  {
    route: firstPlanRoute, target: 'plan-summary',
    title: 'Cost and suggested price',
    body: 'Here is the plan\'s break-even cost and the suggested selling price (cost + your markup). Switch the billing cycle at the top of the page to see annual or multi-year figures.',
    missing: 'Create a plan first — this panel shows its cost and suggested price.',
  },
  {
    route: firstPlanRoute, target: 'plan-prices',
    title: 'Set your selling prices',
    body: 'Enter the price you actually charge for each billing cycle — in LYD, and in USD/EUR if you also sell in those. The margin appears next to each price.',
    missing: 'Create a plan first — this is where its selling prices go.',
  },
  {
    route: '/reports', target: 'report-controls',
    title: '5 · Share a report with management',
    body: 'Choose all plans, a category, or specific plans. Set the exchange rate for the report (it\'s printed on it), pick the cycle and currency, and add a short note.',
  },
  {
    route: '/reports', target: 'report-print',
    title: 'Print or save as PDF',
    body: 'Click here and choose "Save as PDF" to share the report. CSV downloads the same table for Excel.',
  },
  {
    title: 'You\'re all set ✅',
    body: 'That\'s the whole flow. You can reopen this tour anytime from "Guided tour" in the sidebar.',
  },
]

const PAD = 6
const W = 350

export default function Tour() {
  const { tourOpen, tourStep, tourSeen, startTour, setTourStep, endTour } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [rect, setRect] = useState(null)
  const [missing, setMissing] = useState(false)
  const boxRef = useRef(null)
  const [boxH, setBoxH] = useState(180)

  const step = STEPS[Math.min(tourStep, STEPS.length - 1)]
  const last = tourStep >= STEPS.length - 1

  // Open automatically once for a new user
  useEffect(() => {
    if (!tourSeen) { const t = setTimeout(startTour, 600); return () => clearTimeout(t) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to the step's page, then find + spotlight its target
  useEffect(() => {
    if (!tourOpen) return
    setRect(null); setMissing(false)
    const route = typeof step.route === 'function' ? step.route(useAppStore.getState()) : step.route
    if (step.route && !route) { setMissing(true); return }
    if (route && location.pathname !== route) { navigate(route); return }   // effect re-runs on the new page
    if (!step.target) return

    let el = null, tries = 0, scrolled = false
    const measure = () => {
      el = el && document.body.contains(el) ? el : document.querySelector(`[data-tour="${step.target}"]`)
      if (!el) { if (++tries > 25) setMissing(true); return }
      if (!scrolled) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); scrolled = true }
      const r = el.getBoundingClientRect()
      setRect(prev => (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height)
        ? prev : { top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    const iv = setInterval(measure, 120)   // follows smooth scroll, resizes and late renders
    return () => clearInterval(iv)
  }, [tourOpen, tourStep, location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: ← → to move, Esc to skip
  useEffect(() => {
    if (!tourOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') endTour()
      else if (e.key === 'ArrowRight') last ? endTour() : setTourStep(tourStep + 1)
      else if (e.key === 'ArrowLeft' && tourStep > 0) setTourStep(tourStep - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tourOpen, tourStep, last]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { if (boxRef.current) setBoxH(boxRef.current.offsetHeight) })

  if (!tourOpen) return null

  // Tooltip position: below the target, else above, else centred
  const vw = window.innerWidth, vh = window.innerHeight
  let pos
  if (rect && !missing) {
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - W / 2), vw - W - 12)
    if (rect.top + rect.height + PAD + 12 + boxH < vh) pos = { top: rect.top + rect.height + PAD + 12, left }
    else if (rect.top - PAD - 12 - boxH > 0) pos = { top: rect.top - PAD - 12 - boxH, left }
    else pos = { top: Math.max(12, vh - boxH - 24), left }
  } else {
    pos = { top: Math.max(12, vh / 2 - boxH / 2), left: Math.max(12, vw / 2 - W / 2) }
  }
  const spot = rect && !missing

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" aria-live="polite">
      {/* Dim the page; the highlighted element stays visible and clickable */}
      {spot ? (
        <div
          className="fixed rounded-xl ring-2 ring-primary transition-all duration-200"
          style={{
            top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/50 pointer-events-auto" style={{ background: 'rgba(15,23,42,0.55)' }} />
      )}

      {/* Step card */}
      <div
        ref={boxRef}
        role="dialog"
        aria-label={step.title}
        className="fixed pointer-events-auto bg-card border border-border rounded-2xl shadow-2xl p-5 transition-[top,left] duration-200"
        style={{ top: pos.top, left: pos.left, width: W }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-primary">
            <Compass size={13} /> Step {tourStep + 1} of {STEPS.length}
          </div>
          <button onClick={endTour} className="text-slate-500 hover:text-slate-200" title="Skip tour (Esc)"><X size={15} /></button>
        </div>
        <div className="h-1 rounded-full bg-border mt-2 mb-3 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((tourStep + 1) / STEPS.length) * 100}%` }} />
        </div>
        <h3 className="text-base font-bold text-slate-100">{step.title}</h3>
        <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{missing && step.missing ? step.missing : step.body}</p>

        <div className="flex items-center justify-between mt-4">
          <button onClick={endTour} className="text-xs text-slate-500 hover:text-slate-300">Skip tour</button>
          <div className="flex gap-2">
            {tourStep > 0 && (
              <button onClick={() => setTourStep(tourStep - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-slate-300 hover:bg-border/50">
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <button onClick={() => (last ? endTour() : setTourStep(tourStep + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-bg hover:opacity-90">
              {last ? 'Finish' : tourStep === 0 ? 'Start' : 'Next'} {!last && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
