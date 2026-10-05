/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        display: ['Rubik', 'Cairo', 'sans-serif'],
      },
      colors: {
        arcade: {
          dark: '#0a0b14',
          card: '#16182c',
          gold: '#fbbf24',
          cyan: '#06b6d4',
          pink: '#f43f5e',
          purple: '#8b5cf6',
          emerald: '#10b981'
        }
      }
    },
  },
  plugins: [],
}
