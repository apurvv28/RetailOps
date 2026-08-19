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
        forest: {
          50: '#f2f9f5',
          100: '#e1f2e7',
          200: '#c3e5d0',
          300: '#94d1ab',
          400: '#5db37e',
          500: '#1e7f53',
          600: '#166534',
          700: '#0f5235',
          800: '#0b3d27',
          900: '#072b1c',
          950: '#03170e',
        },
        dark: {
          bg: '#060907',
          card: '#0E1411',
          border: '#15241D',
          muted: '#1F342B',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
