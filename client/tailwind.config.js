/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae3',
          300: '#b0bac9',
          400: '#8593a8',
          500: '#65758d',
          600: '#4f5d74',
          700: '#414c5f',
          800: '#384250',
          900: '#313a46',
          950: '#1d232c',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.05), 0 12px 28px -16px rgba(15, 23, 42, 0.25)',
        lift: '0 18px 45px -22px rgba(15, 23, 42, 0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.45)' },
          '70%': { boxShadow: '0 0 0 8px rgba(16, 185, 129, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.22,.8,.32,1) both',
        'toast-in': 'toast-in .25s ease-out both',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(.4,0,.6,1) infinite',
      },
    },
  },
  plugins: [],
};
