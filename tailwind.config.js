/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      /* ── Shadcn UI color vars (unchanged) ── */
      fontFamily: {
        sans: ["Outfit", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
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
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* ── DevFlow design tokens ── */
        df: {
          "bg-deep":   "#070B14",
          "bg-panel":  "#0D1320",
          cyan:        "#31E8FF",
          purple:      "#A855F7",
          green:       "#22C55E",
          orange:      "#F97316",
          red:         "#EF4444",
          "text-primary":   "#F3F4F6",
          "text-secondary": "#9CA3AF",
        },
      },

      /* ── Border radius ── */
      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },

      /* ── Neon box-shadow presets ── */
      boxShadow: {
        "neon-cyan":    "0 0 12px rgba(49,232,255,0.6), 0 0 24px rgba(49,232,255,0.2)",
        "neon-purple":  "0 0 12px rgba(168,85,247,0.6), 0 0 24px rgba(168,85,247,0.2)",
        "neon-green":   "0 0 10px rgba(34,197,94,0.8),  0 0 20px rgba(34,197,94,0.3)",
        "neon-orange":  "0 0 10px rgba(249,115,22,0.7), 0 0 20px rgba(249,115,22,0.2)",
        "card-glass":   "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        "card-hover":   "0 16px 48px rgba(0,0,0,0.5), 0 0 40px rgba(49,232,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
        "sidebar":      "inset 0 0 80px rgba(0,0,0,0.3), 10px 0 40px rgba(0,0,0,0.4)",
        "btn-cyan":     "0 4px 20px rgba(49,232,255,0.3)",
        "btn-cyan-hover":"0 6px 30px rgba(49,232,255,0.5)",
      },

      /* ── Backdrop blur levels ── */
      backdropBlur: {
        xs:  "4px",
        sm:  "8px",
        md:  "16px",
        lg:  "24px",
        xl:  "32px",
        "2xl": "40px",
        "3xl": "64px",
      },

      /* ── Animation durations ── */
      transitionDuration: {
        400: "400ms",
        700: "700ms",
      },

      /* ── Keyframes & animations ── */
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(34,197,94,0.6)" },
          "50%":       { boxShadow: "0 0 18px rgba(34,197,94,0.9), 0 0 30px rgba(34,197,94,0.3)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.25" },
          "50%":       { opacity: "0.55" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(100%)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "pulse-glow":     "pulse-glow 2s ease-in-out infinite",
        "fade-in-up":     "fade-in-up 0.4s ease-out both",
        "fade-in":        "fade-in 0.3s ease-out both",
        shimmer:          "shimmer 1.5s linear infinite",
        "glow-pulse":     "glow-pulse 4s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out both",
        "spin-slow":      "spin-slow 3s linear infinite",
      },
    },
  },
  plugins: [],
};
