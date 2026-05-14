/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        kotofon: {
          primary: "#E85D2A",
          secondary: "#2F7D6D",
          accent: "#3B82F6",
          bg: "#FAF7F2",
          surface: "#FFFFFF",
          text: "#1C1917",
          muted: "#78716C",
          darkBg: "#1C1917",
          darkSurface: "#292524"
        }
      },
      boxShadow: {
        sheet: "0 -16px 48px rgba(28, 25, 23, 0.22)",
        result: "0 16px 48px rgba(28, 25, 23, 0.18)"
      }
    }
  },
  plugins: []
};
