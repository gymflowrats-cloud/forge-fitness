/** @type {import('tailwindcss').Config} */
// Design tokens sampled from the Pocket screenshots. Colors are CSS variables so dark mode can swap them.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)', fg: '#FFFFFF' },
        hero: { from: '#3E5444', to: '#2C3B30' },
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        track: 'rgb(var(--c-track) / <alpha-value>)',
        soft: 'rgb(var(--c-soft) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: { card: '24px', btn: '16px' },
      boxShadow: {
        card: '0 1px 2px rgba(28,28,26,0.04), 0 4px 16px rgba(28,28,26,0.04)',
        float: '0 8px 30px rgba(28,28,26,0.12)',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(0.92)' }, '100%': { transform: 'scale(1)' } },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        pop: 'pop 220ms ease-out',
        'slide-up': 'slide-up 260ms cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
