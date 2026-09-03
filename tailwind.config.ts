import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rog: {
          purple: "#3B1E6E",
          blue: "#2E4FD1",
          pink: "#E85D9E",
          cream: "#F7F1EA",
          peach: "#F0D5C4",
          ink: "#0F0F0F",
          muted: "#5B5560",
          line: "#E4DED6"
        }
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
