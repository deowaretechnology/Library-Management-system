import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-display)", "Georgia", "serif"],
      },
      colors: {
        // Interactive color — buttons, links, focus states, app-wide.
        brand: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          500: "#4F46E5",
          600: "#4338CA",
          700: "#372FA0",
        },
        // Deep ink-navy — dark panels (app login side panel). Evokes a library ledger.
        ink: {
          800: "#1B2A47",
          900: "#101B33",
          950: "#0A1327",
        },
        // Warm cream — marketing-page backgrounds.
        cream: {
          50: "#FBF6EC",
          100: "#F5ECD8",
        },
        // Aged brass/gold — accent line, gilt page edges. Also the "warm highlight" word color.
        brass: {
          300: "#E3C173",
          400: "#E0942F",
          500: "#C97A1A",
          600: "#96701F",
        },
        // Primary green — the library's core brand color, buttons, headline highlight.
        forest: {
          50: "#EAF4EE",
          500: "#1F7A50",
          600: "#186340",
          700: "#123E2C",
        },
      },
    },
  },
  plugins: [],
};

export default config;
