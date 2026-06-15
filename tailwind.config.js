/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'cockpit-bg': '#0f172a',
        'cockpit-card': '#1e293b',
        'cockpit-border': '#334155',
        'approval': '#fbbf24',
        'blocker': '#ef4444',
        'success': '#10b981',
      }
    },
  },
  plugins: [],
}
