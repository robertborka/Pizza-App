/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
      "./src/**/*.{js,ts,jsx,tsx}",
      "./src/components/**/*.{js,ts,jsx,tsx}",
      "./src/app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
      extend: {
          colors: {
              primary: '#f13a01',
          },
      },
  },
  plugins: [],
};
