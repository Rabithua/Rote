/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'primary': 'linear-gradient(272deg, rgba(7, 193, 96, 0.96) -0.55%, rgba(178, 207, 62, 0.96) 99.45%)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

