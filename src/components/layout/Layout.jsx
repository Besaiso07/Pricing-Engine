import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Toaster } from 'react-hot-toast'
import useAppStore from '../../store/appStore'

export default function Layout() {
  const lang = useAppStore(s => s.lang)
  return (
    <div className={`flex min-h-screen ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#252a3d', color: '#e2e8f0', border: '1px solid #2e3555', fontSize: '14px' },
        }}
      />
    </div>
  )
}
