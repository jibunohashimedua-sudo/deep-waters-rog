import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  // The app toggles dark via a data-attribute on <html>, not via
  // prefers-color-scheme. This tells Tailwind's `dark:` variant to match that.
  darkMode: ["selector", '[data-theme="dark"]'],
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
        display: ["Poppins", "system-ui", "sans-serif"],
        serif: [
          '"Source Serif 4"',
          '"Iowan Old Style"',
          '"Charter"',
          "Georgia",
          "serif"
        ]
      }
    }
  },
  plugins: []
} satisfies Config;
