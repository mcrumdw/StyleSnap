import type { Config } from "tailwindcss";

// Every value here comes from DESIGN.md — the single source of truth.
// Never add a color, radius, shadow, or size that isn't defined there.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-primary": "#5B2EFF",
        "brand-primary-hover": "#4A21E0",
        "brand-primary-active": "#3D17C2",
        "brand-accent": "#FF4D8D",
        "brand-pop": "#FFD23D",
        "surface-page": "#FAF8F5",
        "surface-card": "#FFFFFF",
        "text-primary": "#14121F",
        "text-muted": "#6B6878",
        "border-default": "#14121F",
        "focus-ring": "#5B2EFF",
        error: "#DC2626",
        "error-hover": "#B91C1C",
        success: "#1FB877",
        "success-text": "#0E7A4E",
        warning: "#F5A623",
        "warning-text": "#92400E",
        info: "#2E8BFF",
        "info-text": "#1D6FD8",
        "state-disabled-bg": "#ECEAF2",
        "state-disabled-text": "#A8A4B5",
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "24px",
      },
      boxShadow: {
        card: "4px 4px 0 0 #14121F",
        modal: "8px 8px 0 0 #14121F",
      },
      fontFamily: {
        heading: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "page-title": ["48px", { lineHeight: "1.05" }],
        "section-header": ["30px", { lineHeight: "1.15" }],
        "card-title": ["20px", { lineHeight: "1.3" }],
        caption: ["13px", { lineHeight: "1.4" }],
        badge: ["11px", { lineHeight: "1.4" }],
      },
      height: {
        "btn-sm": "36px",
        "btn-md": "44px",
        "btn-lg": "52px",
      },
      zIndex: {
        content: "0",
        sticky: "10",
        dropdown: "40",
        modal: "50",
        toast: "60",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      maxWidth: {
        container: "1200px",
      },
    },
  },
  plugins: [],
} satisfies Config;
