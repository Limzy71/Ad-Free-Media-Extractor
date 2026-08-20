/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "media",
  content: [
    "./popup/**/*.{ts,tsx}",
    "./contents/**/*.{ts,tsx}",
    "./tabs/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        }
      },
      aspectRatio: {
        'vertical': '9 / 16'
      }
    }
  },
  plugins: []
}
