# Connecting PricingEngine to Supabase (free, ~5 minutes)

This moves your data from the browser into a real cloud database, so it survives
refreshes, port changes, different browsers, and different computers — and Supabase
backs it up automatically. The free tier is plenty (500 MB).

You do the 5 dashboard steps below; the app code is already done.

---

## 1. Create a free Supabase project
1. Go to **https://supabase.com** → **Start your project** → sign in (GitHub or email).
2. **New project**:
   - **Name**: `pricing-engine` (anything)
   - **Database Password**: pick a strong one and save it somewhere
   - **Region**: choose the closest (e.g. **Frankfurt** or **London** for Libya)
   - Plan: **Free**
3. Wait ~2 minutes for it to provision.

## 2. Create the table
1. Left sidebar → **SQL Editor** → **New query**.
2. Open the file **`supabase/schema.sql`** in this project, copy everything, paste it in.
3. Click **Run**. You should see “Success”.

## 3. Get your keys
1. Left sidebar → **Project Settings** (gear) → **API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

## 4. Add the keys to the app
1. In the project folder (`PRICING ENGINE`), create a file named **`.env`**
   (you can copy `.env.example`).
2. Put your values in it:
   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your-long-anon-key...
   ```
3. **Save the file.**

## 5. Restart and verify
1. Stop the dev server (Ctrl+C in its terminal) and run **`npm run dev`** again
   (env vars are only read at startup).
2. Open **http://localhost:5173** → **Settings**.
3. The **Cloud Database (Supabase)** card should show a green **“Synced”** badge.
4. Your current data is pushed up automatically on first connect.

> **Restoring your June 6 data first?** Do **Settings → Restore** (pick your backup
> `.json`) *before* step 5, or right after — once connected, that data syncs to the cloud.

---

## How it works
- On startup the app **pulls** your data from Supabase (falling back to local storage if offline).
- Every change is **saved to the cloud automatically** (debounced ~1.5s). You'll see the badge flip to "Saving…" then "Synced".
- **Settings → Cloud Database** has manual **“Save to cloud now”** and **“Pull from cloud”** buttons.
- On a second computer: install the app, add the **same `.env`**, run it — your data loads from the cloud.

## Security note
The included SQL uses a permissive access policy — fine for an **internal, single-user,
localhost** tool. Before putting this on a public URL, add Supabase **Auth** and
row-level rules. Ask and I'll wire that up.

## Cost
Supabase Free tier: 500 MB database, automatic backups, no credit card. This app's
data is well under 1 MB, so it stays free indefinitely.
