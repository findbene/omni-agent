/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        omni: {
          bg: '#0a0e1a',
          surface: '#111827',
          card: '#1a1f35',
          border: 'rgba(255,255,255,0.08)',
          accent: '#6366f1',
          'accent-light': '#818cf8',
          'accent-dark': '#4f46e5',
          purple: '#8b5cf6',
          text: '#e2e8f0',
          muted: '#94a3b8',
        }
      },
      animation: {
        'slide-in': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-out': 'slideOutRight 0.25s ease-in forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'fab-pulse': 'fabPulse 3s ease-in-out infinite',
        'dot-bounce': 'dotBounce 1.4s ease-in-out infinite',
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(100%)', opacity: '0' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'scale(0.85)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        fabPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(99,102,241,0.4), 0 8px 32px rgba(0,0,0,0.3)' },
          '50%': { boxShadow: '0 0 32px rgba(99,102,241,0.6), 0 8px 32px rgba(0,0,0,0.3)' },
        },
        dotBounce: {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
