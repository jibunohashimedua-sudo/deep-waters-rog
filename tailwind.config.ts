import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  // The app toggles dark via a data-attribute on <html>, not via
  // prefers-color-scheme. This tells Tailwind's `dark:` variant to match that.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Fathom. Light-mode values live here; dark mode is handled by the
        // token overrides in globals.css, which patch these same utilities.
        // `pink` and `peach` are retired as colours — the app has one accent
        // and one state colour — but the names survive so the call sites
        // still asking for them resolve to something sensible.
        rog: {
          purple: "#3B23B8",
          blue: "#2A1B8C",
          pink: "#3B23B8",
          cream: "#EDEFF2",
          peach: "#E3E6EB",
          ink: "#0C0F16",
          muted: "#565E6D",
          line: "#CFD4DC",
          sonar: "#067A5A"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        serif: [
          "var(--font-serif)",
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
