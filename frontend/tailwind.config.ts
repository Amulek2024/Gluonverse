import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        space: "#070A10",
        panel: "#111827",
        panelSoft: "#172033",
        line: "#2D3748",
        cyanField: "#4DD0E1",
        amberSignal: "#F2B84B",
        roseSignal: "#FF5D73",
        greenSignal: "#5BE49B",
        blueSignal: "#62A8FF"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;

