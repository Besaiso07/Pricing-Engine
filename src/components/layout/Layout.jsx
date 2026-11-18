import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Tour from '../Tour'
import { Toaster } from 'react-hot-toast'
import useAppStore from '../../store/appStore'
import { useThemeHex } from '../../utils/theme'

export default function Layout() {
  const lang = useAppStore(s => s.lang)
  const theme = useAppStore(s => s.theme)
  const t = useThemeHex()
  // Bright theme by default; the `dark` class on <html> switches the CSS color variables.
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])
  return (
    <div className={`flex min-h-screen ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Tour />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: t.card, color: t.text, border: `1px solid ${t.border}`, fontSize: '14px' },
        }}
      />
    </div>
  )
}
