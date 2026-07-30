import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070b12",
          900: "#0b1220",
          800: "#121a2b",
          700: "#1c2740"
        },
        signal: {
          50: "#ecfdf8",
          100: "#d1faf0",
          200: "#a7f3e1",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59"
        },
        paper: {
          50: "#f5f7f9",
          100: "#e8eef3"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        panel: "0 1px 0 rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.06)"
      }
    }
  },
  plugins: []
} satisfies Config;
