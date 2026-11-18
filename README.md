# PricingEngine

A costing and pricing tool for hosting and digital-service providers. It works out what each service plan
**really costs in LYD** and recommends a **selling price**, even when vendors bill in USD or EUR and the
dinar moves.


## What it does

- **Cost components:** licences, servers, bandwidth, labour and so on, entered in **USD, EUR or LYD**,
  billed monthly, yearly or one-time. Each one is converted to a monthly LYD cost.
- **Exchange rates:** official (CBL) and parallel (market) rates, plus an **FX risk buffer** and optional
  monthly inflation.
- **Service plans:** for example shared hosting, VPS, SSL or domains. Each plan is sold in its own billing
  cycles (monthly to triennially), with your own selling price per cycle in **LYD, USD and EUR**.
- **Cost centers:** shared infrastructure, such as one server running hundreds of accounts, is split across
  plans by **client capacity**.
- **Break-even, suggested price and margin** for every plan and billing cycle, with the full working shown
  (vendor amount × exchange rate × buffer).
- **Dashboard alerts:** uncosted plans, plans below the target margin, and loss-making plans.
- **FX simulator:** what happens to every plan if the rate moves.
- **Management reports:** choose all plans, a category or specific plans, set an exchange rate for the
  report, then **save as PDF** or download CSV.
- **Plan history:** every change to prices, vendor costs, capacity or rates, shown as before → after with
  its effect on cost.
- Bright and dark themes, English and Arabic, and a **guided tour** for first-time users.

## Run it locally

You need **[Node.js](https://nodejs.org) 18 or newer**.

```bash
git clone https://github.com/Besaiso07/Pricing-Engine.git
cd Pricing-Engine
npm install
npm run dev
```

Open **http://localhost:5173**. The guided tour starts on your first visit, and you can reopen it anytime
from **Guided tour** in the sidebar.

Other commands:

```bash
npm run build     # production build into dist/
npm run preview   # serve the production build
```

> Keep the port at **5173**. Your data is stored per browser *and* per port, so a different port opens
> with empty demo data.

## Your data

- Data is saved **in your browser**. A fresh install starts with demo data.
- **Settings → Export Backup** downloads everything as a `.json` file. **Settings → Restore** loads it on
  any computer or browser. This is how to hand your real figures to a colleague: send the backup file
  privately. It contains your real costs and prices, so **never commit it to the repo**.
- Export a backup after large changes.

### Optional: cloud database (Supabase)

To keep data in a cloud database instead of the browser, follow **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)**:
create a free project, run `supabase/schema.sql`, and put your keys in a local `.env` file (copy
`.env.example`). The `.env` file is git-ignored and must never be committed. Without it, the app works in
browser-only mode.

> The sample `schema.sql` allows anyone who has your anon key to read and write. Fine for a single
> internal user; add Supabase Auth and row-level policies before several people share one database.

## How the numbers are calculated

| Step | Formula |
|---|---|
| Cost in LYD | vendor amount × exchange rate × (1 + FX buffer %); LYD costs aren't buffered |
| Monthly cost | yearly ÷ 12 · one-time ÷ amortisation months (default 24) |
| Shared cost per plan | cost-center total × plan capacity ÷ total capacity |
| Cost per client | plan's share ÷ plan's client capacity |
| Suggested price | cost × (1 + markup %) |
| Margin | (price − cost) ÷ price |

All LYD amounts are shown with 3 decimals.

## Tech

React 18 · Vite 4 · Tailwind CSS 3 · Zustand (saved to localStorage) · Recharts · optional Supabase.

```
src/
  store/appStore.js     all state and every calculation
  pages/                Dashboard, Cost Components, Cost Centers, Service Plans, Plan Detail,
                        FX Simulator, Reports, Categories, Activity Log, Settings
  components/           UI parts, the PDF reports, plan history, guided tour
  data/mockData.js      demo data, billing cycles, default settings
```

Notes for contributors (and AI coding assistants) are in **[CLAUDE.md](CLAUDE.md)**.
