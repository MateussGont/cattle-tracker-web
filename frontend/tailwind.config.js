/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        status: {
          online: "#16a34a",
          attention: "#d97706",
          offline: "#dc2626",
          unknown: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};
