/** @type {import('tailwindcss').Config} */
module.exports = {
  // darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'primary': 'linear-gradient(272deg, rgba(7, 193, 96, 0.96) -0.55%, rgba(178, 207, 62, 0.96) 99.45%)',
      },
      colors: {
        'bgDark': '#111111',
        'bgWhite': '#f8f8f8'
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

