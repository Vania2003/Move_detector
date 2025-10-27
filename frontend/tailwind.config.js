/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
  safelist: [
    { pattern: /(bg|text|border)-(red|emerald|blue|indigo)-(50|200|400|700|900)/ }
  ]
};
