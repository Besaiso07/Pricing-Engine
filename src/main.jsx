import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initCloudSync } from './lib/cloudSync'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Connect to Supabase (no-op if no credentials configured). Runs after first paint
// so the localStorage-cached UI shows instantly, then cloud reconciles.
initCloudSync()

