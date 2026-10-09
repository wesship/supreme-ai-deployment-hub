/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/components/sovereign/approved/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#050607",
          50: "#050607",
          100: "#090B0D",
          200: "#111419",
          300: "#1A1E25",
          400: "#242A31",
        },
        foreground: {
          DEFAULT: "#F7FBFF",
          50: "#A9C3D6",
          100: "#B5C9DA",
          200: "#C4D6E4",
          300: "#D3E0EC",
          400: "#DFEAF3",
          500: "#E6F1FA",
          600: "#ECF3FA",
          700: "#F2F7FC",
          800: "#F7FBFF",
          900: "#F7FBFF",
          950: "#FFFFFF",
        },
        primary: {
          DEFAULT: "#3B9BFF",
          300: "#A9D6FF",
          400: "#6EB8FF",
          500: "#3B9BFF",
          600: "#2378E0",
          700: "#1A5FB3",
        },
        accent: {
          DEFAULT: "#3DDCFF",
          300: "#BFF3FF",
          400: "#7DF1FF",
          500: "#3DDCFF",
          600: "#23B8D6",
        },
        secondary: {
          DEFAULT: "#4D7CFF",
          300: "#B7C5FF",
          400: "#7EA8FF",
          500: "#4D7CFF",
          600: "#3A5FD1",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["'Space Grotesk'", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}