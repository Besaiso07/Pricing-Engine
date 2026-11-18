import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import CostComponents from './pages/CostComponents'
import CostCenters from './pages/CostCenters'
import ServicePlans from './pages/ServicePlans'
import PlanDetail from './pages/PlanDetail'
import ActivityLog from './pages/ActivityLog'
import Categories from './pages/Categories'
import Simulator from './pages/Simulator'
import Reports from './pages/Reports'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/components" element={<CostComponents />} />
          <Route path="/cost-centers" element={<CostCenters />} />
          <Route path="/plans" element={<ServicePlans />} />
          <Route path="/plans/:id" element={<PlanDetail />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
