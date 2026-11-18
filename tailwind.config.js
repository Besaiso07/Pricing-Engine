/** @type {import('tailwindcss').Config} */
// Colors come from CSS variables (src/index.css) so the app can switch between
// the bright (default) and dark themes. Values are "R G B" triplets so opacity
// modifiers like bg-primary/10 keep working.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        card: v('card'),
        border: v('border'),
        primary: v('primary'),
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        purple: v('purple'),
        muted: v('muted'),
        // Text greys: slate-100 = strongest text … slate-700 = faintest, in BOTH themes.
        slate: {
          100: v('slate-100'), 200: v('slate-200'), 300: v('slate-300'), 400: v('slate-400'),
          500: v('slate-500'), 600: v('slate-600'), 700: v('slate-700'),
        },
      },
    },
  },
  plugins: [],
}
