/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["DM Sans", "sans-serif"]
      },
      boxShadow: {
        card: "0 15px 40px rgba(13, 30, 56, 0.08)"
      }
    }
  },
  plugins: []
};
