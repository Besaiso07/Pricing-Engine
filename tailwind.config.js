/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1c2030',
        card: '#252a3d',
        border: '#2e3555',
        primary: '#60a5fa',
        success: '#4ade80',
        warning: '#fbbf24',
        danger: '#f87171',
        purple: '#a78bfa',
        muted: '#6b7280',
      },
    },
  },
  plugins: [],
}
