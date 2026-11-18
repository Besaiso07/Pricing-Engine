import useAppStore from '../store/appStore'

// Hex values of the theme colors, for places that can't use CSS classes (Recharts, toasts).
// Keep in sync with the CSS variables in src/index.css.
export const THEME_HEX = {
  light: {
    bg: '#f4f7fc', card: '#ffffff', border: '#dfe5ef', text: '#1e293b', axis: '#64748b',
    primary: '#2563eb', success: '#16a34a', warning: '#d97706', danger: '#dc2626', purple: '#7c3aed',
  },
  dark: {
    bg: '#1c2030', card: '#252a3d', border: '#2e3555', text: '#e2e8f0', axis: '#94a3b8',
    primary: '#60a5fa', success: '#4ade80', warning: '#fbbf24', danger: '#f87171', purple: '#a78bfa',
  },
}

export const useThemeHex = () => THEME_HEX[useAppStore(s => s.theme) === 'dark' ? 'dark' : 'light']

// Shared Recharts tooltip style for the current theme.
export const tooltipStyle = (t) => ({
  background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12, color: t.text,
})
