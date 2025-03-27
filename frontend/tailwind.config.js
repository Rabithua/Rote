const {
  default: flattenColorPalette,
} = require("tailwindcss/lib/util/flattenColorPalette");

const svgToDataUri = require("mini-svg-data-uri");

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
        'primaryGreenGradient': 'linear-gradient(327deg, #07C160 18.08%, rgba(62, 207, 74, 0.96) 64.28%, rgba(153, 230, 38, 0.40) 111.94%, rgba(250, 255, 0, 0.00) 158.87%);'
      },
      colors: {
        'bgLight': '#ffffff',
        'bgDark': '#000000',
        'opacityLight': '#00000010',
        'opacityDark': '#ffffff10',
        'textDark': '#E7E9EA',
        'textLight': '#0F1419',
        'primary': '#07C160',
      },
      animation: {
        "meteor-effect": "meteor 5s linear infinite",
        "show": "show 600ms ease-in-out forwards",
      },
      keyframes: {
        meteor: {
          "0%": { transform: "rotate(215deg) translateX(0)", opacity: 1 },
          "70%": { opacity: 1 },
          "100%": {
            transform: "rotate(215deg) translateX(-500px)",
            opacity: 0,
          },
        },
        show: {
          "0%": { transform: "translateY(20px)", opacity: 0 },
          "100%": { transform: "translateY(0px)", opacity: 1 },
        },
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        zhengwen: ['Optima-Regular,Optima', 'PingFangSC-light', 'PingFangTC-light', 'PingFang SC', "Cambria", 'Cochin', 'Georgia', 'Times', 'Times New Roma']
      },
      boxShadow: {
        'card': '0px 0px 60px rgba(0, 0, 0, 0.05)',
      }
    },
  },

  plugins: [
    require('@tailwindcss/typography'),
    require("@tailwindcss/aspect-ratio"), addVariablesForColors,
    function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          "bg-grid": (value) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="${value}"><path d="M0 .5H31.5V32"/></svg>`
            )}")`,
          }),
          "bg-grid-small": (value) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="8" height="8" fill="none" stroke="${value}"><path d="M0 .5H31.5V32"/></svg>`
            )}")`,
          }),
          "bg-dot": (value) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16" fill="none"><circle fill="${value}" id="pattern-circle" cx="10" cy="10" r="1.6257413380501518"></circle></svg>`
            )}")`,
          }),
        },
        { values: flattenColorPalette(theme("backgroundColor")), type: "color" }
      );
    }
  ],
  safelist: [
    // 背景色和文本色
    "bg-white",
    "bg-[#f5f5f5]",
    "bg-zinc-800",
    "bg-lime-300",
    "text-gray-800",
    "text-[#255136]",
    "text-white",

    // 标签背景和文本色
    "bg-[#00000010]",
    "bg-[#ffffff10]",

    // 边框色
    "border-gray-800",
    "border-[#255136]",
    "border-white",

    // 特定类名
    "cardClass",
    "tagClass",
    "authorClass",
    "colorBlock",
  ]
}

function addVariablesForColors({ addBase, theme }) {
  let allColors = flattenColorPalette(theme("colors"));
  let newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
  );

  addBase({
    ":root": newVars,
  });
}