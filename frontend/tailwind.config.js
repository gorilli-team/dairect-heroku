/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'booking-blue': '#0071c2',
        'booking-blue-dark': '#005ba1',
        'booking-yellow': '#febb02',
        'booking-orange': '#ff8c00'
      },
      fontFamily: {
        'booking': ['BlinkMacSystemFont', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
      }
    },
  },
  plugins: [],
}
