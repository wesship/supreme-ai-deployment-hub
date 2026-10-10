import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        md: "2rem",
        lg: "2.5rem",
        xl: "3rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1200px",
        "2xl": "1320px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          hover: "hsl(var(--accent-hover))",
          active: "hsl(var(--accent-active))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          "1": "hsl(var(--surface-1))",
          "2": "hsl(var(--surface-2))",
          "3": "hsl(var(--surface-3))",
        },
        status: {
          success: "hsl(var(--status-success))",
          warning: "hsl(var(--status-warning))",
          danger: "hsl(var(--status-danger))",
          info: "hsl(var(--status-info))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      spacing: {
        "18": "72px",
        "22": "88px",
        "26": "104px",
        "30": "120px",
      },
      borderRadius: {
        xs: "6px",
        sm: "8px",
        DEFAULT: "var(--radius)",
        md: "12px",
        lg: "16px",
        xl: "20px",
        pill: "999px",
      },
      fontSize: {
        h1: ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["40px", { lineHeight: "48px", letterSpacing: "-0.02em", fontWeight: "700" }],
        h3: ["32px", { lineHeight: "40px", letterSpacing: "-0.015em", fontWeight: "700" }],
        h4: ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        h5: ["20px", { lineHeight: "28px", letterSpacing: "-0.005em", fontWeight: "600" }],
        h6: ["16px", { lineHeight: "24px", letterSpacing: "0em", fontWeight: "600" }],
        lead: ["18px", { lineHeight: "28px", letterSpacing: "0em", fontWeight: "500" }],
        body: ["16px", { lineHeight: "26px", letterSpacing: "0em", fontWeight: "400" }],
        "body-strong": ["16px", { lineHeight: "26px", letterSpacing: "0em", fontWeight: "500" }],
        small: ["14px", { lineHeight: "22px", letterSpacing: "0em", fontWeight: "400" }],
        micro: ["12px", { lineHeight: "18px", letterSpacing: "0.01em", fontWeight: "400" }],
        code: ["14px", { lineHeight: "22px", letterSpacing: "0em", fontWeight: "500" }],
      },
      boxShadow: {
        subtle: "0 1px 3px rgba(0, 0, 0, 0.05)",
        elevation: "0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.04)",
        card: "0 2px 6px rgba(0, 0, 0, 0.05), 0 8px 24px rgba(0, 0, 0, 0.03)",
        "card-soft": "0 10px 30px rgba(0, 0, 0, 0.45)",
        "card-hover": "0 16px 44px rgba(0, 0, 0, 0.55)",
        "focus-glow": "0 0 0 3px rgba(59, 255, 122, 0.25)",
        modal: "0 24px 80px rgba(0, 0, 0, 0.70)",
        toast: "0 12px 40px rgba(0, 0, 0, 0.55)",
        highlight: "0 0 0 1px rgba(255, 255, 255, 0.1) inset",
      },
      transitionDuration: {
        instant: "80ms",
        fast: "150ms",
        base: "200ms",
        slow: "300ms",
        page: "240ms",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0.0, 0.0, 1.0)",
        "ease-in-out-custom": "cubic-bezier(0.4, 0.0, 0.2, 1.0)",
        "ease-out-custom": "cubic-bezier(0.0, 0.0, 0.2, 1.0)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fadeInUp": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 240ms cubic-bezier(0.2, 0.0, 0.0, 1.0)",
        "fade-up": "fade-up 240ms cubic-bezier(0.2, 0.0, 0.0, 1.0)",
        "scale-in": "scale-in 200ms cubic-bezier(0.2, 0.0, 0.0, 1.0)",
        "slide-up": "slide-up 0.6s ease-out",
        "slide-down": "slide-down 0.6s ease-out",
        "[fadeInUp_0.6s_ease-out_both]": "fadeInUp 0.6s ease-out both",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
