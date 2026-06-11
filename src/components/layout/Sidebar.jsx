import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Settings, Package, Server, BarChart3, Globe, ShieldCheck, Layers, History, Tag, Sliders } from 'lucide-react'
import useAppStore from '../../store/appStore'
import clsx from 'clsx'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', labelAr: 'لوحة التحكم' },
  { to: '/components', icon: Package, label: 'Cost Components', labelAr: 'مكونات التكلفة' },
  { to: '/cost-centers', icon: Layers, label: 'Cost Centers', labelAr: 'مراكز التكلفة' },
  { to: '/plans', icon: Server, label: 'Service Plans', labelAr: 'خطط الخدمة' },
  { to: '/simulator', icon: Sliders, label: 'FX Simulator', labelAr: 'محاكي الصرف' },
  { to: '/categories', icon: Tag, label: 'Categories', labelAr: 'الفئات' },
  { to: '/activity', icon: History, label: 'Activity Log', labelAr: 'سجل النشاط' },
  { to: '/settings', icon: Settings, label: 'Settings', labelAr: 'الإعدادات' },
]

export default function Sidebar() {
  const { lang, toggleLang } = useAppStore()
  const isAr = lang === 'ar'

  return (
    <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <BarChart3 size={16} className="text-bg" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">PricingEngine</p>
            <p className="text-xs text-slate-500">Cost & Price Manager</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {nav.map(({ to, icon: Icon, label, labelAr }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-border/50'
              )
            }
          >
            <Icon size={17} />
            <span>{isAr ? labelAr : label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Lang toggle */}
      <div className="px-4 py-4 border-t border-border">
        <button
          onClick={toggleLang}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400 hover:bg-border/50 transition-colors border border-border"
        >
          <span>{isAr ? 'English' : 'العربية'}</span>
          <Globe size={14} />
        </button>
      </div>
    </aside>
  )
}
