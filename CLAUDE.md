# CLAUDE.md — Project Memory

> This is the official project-memory file for Claude Code (auto-loaded from the repo root).
> It is plain Markdown, so any IDE or AI assistant can read it too.
> Keep it up to date when the architecture or rules change.

---

## 1. What this is

**PricingEngine** — a SaaS **Costing & Pricing Engine** for a hosting / digital-services company
(**Libyan Spider — ls.ly**). The primary user is the **Finance Manager**.

It lets the company:
- Define reusable **cost components** (licenses, infrastructure, labor, other) in USD / EUR / LYD.
- Build **service plans** (shared hosting, VPS, dedicated, domain, SSL…) and allocate costs to them.
- Pool shared infrastructure costs in **cost centers** and split them across plans by **client capacity**.
- Compute each plan's **true monthly/annual break-even** and a **suggested selling price**.
- Handle the **Libyan reality**: USD/EUR costs vs. LYD revenue, a volatile dinar (official vs. parallel
  rate), an FX risk buffer, and local inflation.

All monetary results are shown in **LYD with 3 decimal places**.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Build tool | **Vite 4** (Node 18 compatible) |
| UI | **React 18** + **React Router 6** |
| Styling | **Tailwind CSS 3** (dark premium theme) |
| State | **Zustand 4** + `persist` middleware (localStorage) |
| Charts | **Recharts** |
| Icons | **lucide-react** |
| Toasts | **react-hot-toast** |
| CSV parsing | **papaparse** |
| Class utils | **clsx** |

Data lives in the browser via Zustand `persist` (localStorage key: `pricing-engine-store`).
An **optional Supabase backend** (`@supabase/supabase-js`) syncs the whole snapshot to a cloud
Postgres DB when `.env` credentials are present — localStorage then acts as an offline cache.
See **§8 Data persistence & the #1 rule** and `SUPABASE_SETUP.md`.

---

## 3. How to run

From the project root:

```bash
npm install      # first time only
npm run dev      # starts Vite on http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

**Always open the app at → http://localhost:5173**

The port is **pinned to 5173** in both `vite.config.js` (`server.port: 5173, strictPort: true`)
and `.claude/launch.json`. Do **not** change it — see §8.

---

## 4. File map

```
PRICING ENGINE/
├── index.html
├── vite.config.js          # port pinned to 5173 (strictPort)
├── tailwind.config.js      # theme colors (see §9)
├── postcss.config.js
├── package.json
├── CLAUDE.md               # this file
├── .claude/
│   └── launch.json         # dev-server launch config (port 5173)
└── src/
    ├── main.jsx            # React entry
    ├── App.jsx             # routes (see §5)
    ├── index.css           # Tailwind + base styles + scrollbar/RTL
    ├── data/
    │   └── mockData.js     # seed data + BILLING_CYCLES + SETTING_DEFAULTS + category seeds
    ├── store/
    │   └── appStore.js     # Zustand store — ALL state, calculations, CRUD, persist
    ├── utils/
    │   └── format.js       # fmtLYD, fmtPct, sellingPrice, marginPct, colorClass, planCyclePrice, palettes
    ├── components/
    │   ├── ui/             # Badge, Button, Input(+Select,Textarea), Modal(+ConfirmModal), Card, ImportButton
    │   └── layout/         # Sidebar, Layout
    └── pages/
        ├── Dashboard.jsx       # KPIs, charts, top-5, repricing alerts
        ├── CostComponents.jsx  # CRUD + CSV import + inflation flag
        ├── CostCenters.jsx     # shared pools, capacity + occupancy, allocation analysis
        ├── ServicePlans.jsx    # list (default) / grid, per-row cycle, compare mode
        ├── PlanDetail.jsx      # cost builder, per-cycle pricing, calc analysis, billing cycles
        ├── Categories.jsx      # manage component & plan categories
        ├── Simulator.jsx       # FX & inflation what-if + bulk re-price (filter + sort)
        ├── Reports.jsx         # management report: pick plans, report FX rate, PDF/CSV
        ├── ActivityLog.jsx     # history of every change
        └── Settings.jsx        # dual FX rates, buffer, inflation, targets, backup/restore, reset
```

---

## 5. Routes (`src/App.jsx`)

| Path | Page |
|---|---|
| `/` | Dashboard |
| `/components` | Cost Components |
| `/cost-centers` | Cost Centers |
| `/plans` | Service Plans (list view is default) |
| `/plans/:id` | Plan Detail |
| `/simulator` | FX & Inflation Simulator |
| `/reports` | Management Reports |
| `/categories` | Categories |
| `/activity` | Activity Log |
| `/settings` | Master Settings |

---

## 6. Data model (all in `store/appStore.js`)

- **settings**: `{ id, key, value, label, updated_at }` — keys below.
- **components** (cost components): `{ id, name, category, billing_cycle('monthly'|'yearly'|'one_time'), cost_amount, currency('USD'|'EUR'|'LYD'), vendor, notes, is_active, inflation_indexed, cost_base_date?, amortize_months?(one_time, default 24), created_at }`
- **plans** (service plans): `{ id, name, category, description, specs(jsonb), markup_override_pct|null, current_price?(legacy monthly), current_prices{ [cycleKey]: number }, current_prices_fx?{ USD|EUR: { [cycleKey]: number } }, billing_cycles[], status('draft'|'active'|'archived'), created_at }`
- **allocations** (direct plan↔component): `{ id, plan_id, component_id, allocation_weight(0–1), allocation_notes, created_at }`
- **costCenters**: `{ id, name, category, description, created_at }`
- **costCenterComponents**: `{ id, cost_center_id, component_id, is_dedicated, dedicated_plan_id|null, created_at }`
- **costCenterPlans**: `{ id, cost_center_id, plan_id, max_clients, actual_clients, created_at }`
- **componentCategories / planCategories**: `{ id, key, label, color }` (color ∈ palette, see §9)
- **activityLog**: `{ id, at, action, entity, name, details }`
- **planHistory**: `{ id, at, planId, kind('price'|'cost'|'capacity'|'rate'|'setting'|'plan'), title, changes[{label,from,to}],
  cost{from,to}, suggested{from,to}, mergeKey }` — per-plan change log (capped 5000). Every mutation that can affect a
  plan takes `_planSnap()` first and calls `_recordPlanImpact(before, {...})` after: an entry is written for each plan
  named in `planIds` **or** whose monthly cost/client or suggested price moved. Keystroke edits merge via `mergeKey`
  (same field, < 2 min). **New mutations that affect cost or price must do the same.** Shown by `components/PlanHistory.jsx`.
- **rateHistory**: `{ id, at, key, from, to }` — auto-recorded on every FX rate / `fx_mode` / `fx_buffer_pct` change
  (capped at 500, shown in Settings as a table + step chart; no-op saves are skipped).

### Settings keys (with `SETTING_DEFAULTS` fallback in `mockData.js`)
`usd_to_lyd`, `eur_to_lyd` (official/CBL) · `usd_to_lyd_parallel`, `eur_to_lyd_parallel` (market) ·
`fx_mode` (`'official'|'parallel'`) · `fx_buffer_pct` · `monthly_inflation_pct` ·
`default_markup_pct` · `target_margin_pct`.

### Billing cycles (`BILLING_CYCLES` in `mockData.js`)
`monthly`(×1), `quarterly`(×3), `semi_annually`(×6), `annually`(×12), `biennially`(×24), `triennially`(×36).
Each plan stores which cycles it's sold in (`billing_cycles`) and a **separate manual price per cycle**
(`current_prices[cycleKey]`). Legacy single `current_price` is read as the **monthly** price (fallback).

---

## 7. Calculation logic (the heart of the app — `store/appStore.js`)

1. **Currency → LYD** (`toLYD`): `amount × rate × (1 + fx_buffer_pct/100)`.
   `rate` is the official or parallel rate per `fx_mode`. LYD costs are not buffered.
2. **Monthly component cost** (`monthlyComponentCost`): `toLYD(...)`, then `yearly` ÷ 12 and
   `one_time` ÷ `amortize_months` (default 24 — one-time costs are amortized, **never** charged monthly in full).
   If `inflation_indexed`, multiply by `(1 + monthly_inflation_pct/100) ^ monthsElapsed` (from `cost_base_date`/`created_at`).
   The FX Simulator uses `monthlyComponentCostAtRates(comp, usd, eur)` — same math at hypothetical rates.
3. **Cost-center allocation** (`getCostCenterPlanCost`):
   - **Shared** components are split by **capacity weight** = `plan.max_clients / Σ max_clients`.
   - **Dedicated** components go **100%** to one plan.
   - Occupancy = `actual_clients / max_clients`; `costPerActualClient = totalLYD / actual_clients`.
   - Per-client cost = `totalLYD ÷ max_clients` (full capacity). A "planned occupancy %" basis was tried
     and **removed at the user's request (2026-11-15)** — don't reintroduce it unasked.
   - **Idle-capacity cost** = `totalLYD − perClientCapacity × actual_clients` (≥ 0): cost of unsold slots.
4. **Plan total break-even** (`getPlanTotalCost`) = Σ direct allocations (`monthlyCost × allocation_weight`)
   + Σ cost-center contributions. Result is a **monthly** figure. `unitLYD` = per client (÷ capacity) for shared plans,
   else whole-plan. `isCosted = totalLYD > 0` — an **uncosted** plan never shows a margin (no fake 100%).
5. **Selling price** = `breakEven × (1 + markup/100)`, where `markup = plan.markup_override_pct ?? default_markup_pct`.
6. **Margin %** = `(price − cost) / price × 100`. Margin of a manual price: `planCycleMargin(plan, cycleKey)`
   (null when uncosted or unpriced). Dashboard alerts check **every cycle sold** and flag uncosted plans.
7. **Per cycle**: multiply monthly figures by `cycle.months`. The manual price for a cycle is
   `current_prices[cycleKey]` (falls back to monthly × months for display).
   Show cycles via `sortCycles()` (standard order) and open plans on `defaultCycle()` (monthly → annually → shortest).
8. **USD / EUR selling prices** (`SELL_CURRENCIES` in `mockData.js`): optional manual prices per cycle in
   `plan.current_prices_fx`. LYD figures convert with `fromLYD(lyd, cur)` = `lyd ÷ fxRate(cur)` (the costing rate,
   **no buffer**: it's already in the cost); a USD/EUR price's margin uses `priceToLYD`. Read with
   `planCyclePriceIn(plan, cycle, cur)` / `planCycleMarginIn(...)`; `planPriceMargins(plan)` lists all, for alerts.
9. **Showing the working**: `componentCostSteps(comp)` returns vendor amount, FX rate, buffer, cycle divisor and
   inflation; `components/CostFormula.jsx` renders it ("$250 / mo × 11.000 × 1.05 buffer = 2887.500 LYD / mo")
   in Plan Detail and the printed report.

**Report-rate costing**: `getPlanTotalCost(planId, rates?)` / `getCostCenterPlanCost(cc, plan, rates?)` accept
optional `{ USD, EUR }` to cost at those rates without touching settings. `buildPlanReport({ planIds, rates,
cycleMode, currency })` builds the management report (rows, flags ok/below/loss/no-price/uncosted, summary);
`components/ManagementReport.jsx` renders it (preview + print), `pages/Reports.jsx` holds the controls.

The **FX Simulator** (`Simulator.jsx`) recomputes break-even at hypothetical USD/EUR rates **without**
mutating the store, flags plans below `target_margin_pct` or going negative, and can **apply** the rates
to all plans (bulk re-price). The **Dashboard** shows the same alerts.

---

## 8. Data persistence & THE #1 RULE

- State is saved by Zustand `persist` to **localStorage** under key **`pricing-engine-store`**.
- **`localStorage` is scoped to the exact origin (host + PORT).** Changing the dev-server port,
  using a different browser, or clearing site data makes the app appear "empty" / re-seed demo data.

### 🔴 RULE: never change the dev-server port
It is pinned to **5173**. Changing it moves the storage origin and the user's data "disappears"
(it's not deleted — it's filed under the old origin). This already happened once; do not repeat it.

### 🟢 The safe workflow: Backup & Restore (Settings page)
- **Settings → Export Backup** downloads a full `.json` snapshot (`exportData()` in the store).
- **Settings → Restore** loads it back on any port/browser/machine (`importData()`).
- Tell the user to **export a backup after any large change** (CSV import, bulk re-price).

### 🟢 Cloud database (Supabase) — durable fix
- When `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` exist in `.env`, the app syncs the full
  snapshot to a Supabase Postgres table `app_state` (one jsonb row, id `main`) — see `src/lib/`.
- On startup it **pulls** cloud → store (or seeds the cloud from local on first run); every data
  change **pushes** back (debounced 1.5s). Status + manual Save/Pull live in **Settings → Cloud Database**.
- The sync reuses `exportData()`/`importData()`; `cloudStatus`/`cloudLastSync` are in the store (not persisted).
- It degrades gracefully: no `.env` → localStorage-only, exactly as before. Setup: `SUPABASE_SETUP.md`.
- Document-store for now; can be normalised into per-entity tables later (for SQL reporting / multi-user + auth).

---

## 9. UI / theme conventions

**Bright theme by default**, with a **Dark mode** toggle in the sidebar (`theme` in the store, persisted).
Colors are CSS variables in `src/index.css` (`:root` = bright, `:root.dark` = dark) wired into
`tailwind.config.js`, so classes like `bg-card`, `text-primary`, `bg-primary/10` work in both themes.
`slate-100…700` are remapped too: **slate-100 = strongest text, slate-700 = faintest**, in both themes.
Charts/toasts can't use classes — take hex colors from `useThemeHex()` in `src/utils/theme.js` (keep in sync).

| Token | Bright | Dark | Use |
|---|---|---|---|
| `bg` | `#f4f7fc` | `#1c2030` | page background |
| `card` | `#ffffff` | `#252a3d` | cards / panels |
| `border` | `#dfe5ef` | `#2e3555` | borders / dividers |
| `primary` | `#2563eb` | `#60a5fa` | blue accent / actions |
| `success` | `#16a34a` | `#4ade80` | green / prices / good margin |
| `warning` | `#d97706` | `#fbbf24` | amber / break-even / caution |
| `danger` | `#dc2626` | `#f87171` | red / loss / destructive |
| `purple` | `#7c3aed` | `#a78bfa` | purple accent / dedicated costs |

Category colors are dynamic: each category stores a palette token (`primary|warning|success|purple|danger|muted`);
resolve classes with `colorClass(token)` from `utils/format.js`.

Other conventions:
- **LYD is always formatted with 3 decimals** via `fmtLYD()`. Never hand-format currency.
- Toasts (`react-hot-toast`) for every create/update/delete/import.
- `ConfirmModal` for every destructive action.
- Bilingual EN/AR with RTL toggle (sidebar globe button; `lang` in store).
- Desktop-first; the app is best viewed at full width.

---

## 10. Working rules for AI assistants / contributors

1. **Do not change the dev-server port** (see §8). Keep it 5173 in `vite.config.js` and `.claude/launch.json`.
2. **Never wipe user data.** Don't call `resetData`, clear localStorage, or bump the persist `version`
   without an explicit request + a migration. When testing in the live app, **clean up any test data you add**.
3. **All calculations live in `store/appStore.js`.** Add/extend computed selectors there, not in components,
   so every page stays consistent.
4. **Categories and billing cycles are dynamic** — never hard-code category keys or cycle lists in pages;
   read them from the store (`planCategories`, `componentCategories`, `BILLING_CYCLES`).
5. **Currency:** always convert via `toLYD` / `monthlyComponentCost` (they handle FX mode, buffer, inflation,
   yearly÷12). Always display LYD with `fmtLYD` (3 decimals).
6. **Per-cycle pricing:** read a plan's price with `planCyclePrice(plan, cycleKey)` (handles the legacy
   `current_price` monthly fallback). Don't read `plan.current_price` directly.
7. **Persisted shape:** if you add a new top-level state slice, also add it to `partialize` (persist) and to
   `exportData`/`importData` (backup) and `resetData` (seed).
8. **Verify before claiming done:** run `npm run build` (must pass) and check the page in the running app.
9. **Log meaningful changes** to the activity log via the store's `log(...)` helper inside new mutations.

---

## 11. Feature checklist (current state)

- [x] Master settings: **dual FX rates** (official/CBL vs parallel/market), FX mode, **FX risk buffer**,
      **monthly inflation**, default markup, target margin.
- [x] Cost components: CRUD, CSV import + template, **inflation indexing** flag, currency→LYD display.
- [x] Categories: manage component & plan categories (add/edit/delete-if-unused, color, usage count).
- [x] Service plans: list (default) / grid, CSV import, **per-row billing cycle** + "monthly equivalent"
      compare mode, status, markup override.
- [x] Plan detail: cost builder (direct + cost-center), **per-cycle manual prices**, billing-cycle period
      toggle, full **calculation analysis** with yearly÷12 transparency.
- [x] Cost centers: shared/dedicated components, **capacity + actual clients**, **occupancy**, cost-per-client,
      break-even occupancy, contribution, step-by-step allocation analysis.
- [x] FX & Inflation Simulator: what-if USD/EUR, monthly & annual views, **category filter**, **sortable**
      columns, risk summary, **bulk apply rates**.
- [x] Dashboard: KPIs, category pie, margin-range bar, top-5, **repricing alerts**, FX status bar.
- [x] Activity log: every change, filterable, clearable.
- [x] **Backup & Restore** (export/import JSON) + reset-to-demo.
- [x] **One-time cost amortization** (÷ `amortize_months`, default 24) across all calcs incl. simulator.
- [x] **Exchange rate history**: every rate/mode/buffer change recorded; Settings table + step chart.
- [x] **Plan history**: per-plan log of price, vendor-cost, capacity, allocation, FX/setting and plan-detail changes
      with before → after and the impact on cost per client and suggested price (Plan Detail → History).
- [x] **Guided tour** (`components/Tour.jsx`): 14 steps — exchange rate → 2 cost components → plan → allocate →
      prices → report. Spotlights elements marked `data-tour="…"` (keep those attributes when editing pages);
      auto-opens once (`tourSeen`, persisted), reopen from **Guided tour** in the sidebar; Skip/Esc anytime. Never changes data.
- [x] **Management reports**: all / by category / selected plans, report-specific exchange rate printed on the
      report, cycle + currency (LYD/USD/EUR) options, note, key points, Print/PDF + CSV.

### Possible next steps (not yet built)
- Per-plan / per-cost-center **P&L** (costed vs. actual subscriber revenue).
- **Excel / PDF export** and client quote generator.
- **Supabase/Postgres** backend (replace browser storage).
- Vendor renewal calendar; auto-export reminder.

---

_Last updated: 2026-06-10._
