import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

import baseConfig from "@kan/tailwind-config/web";

export default {
  darkMode: "class",
  content: [...baseConfig.content],
  plugins: [require("@tailwindcss/typography")],
  presets: [baseConfig],
  theme: {
    extend: {
      colors: {
        primary: "var(--theme-colors-primary)",
        secondary: "var(--theme-colors-secondary)",
        background: "var(--theme-colors-background)",
        surface: "var(--theme-colors-surface)",
        text: "var(--theme-colors-text)",
        textMuted: "var(--theme-colors-textMuted)",
        border: "var(--theme-colors-border)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...fontFamily.mono],
        body: ["var(--theme-fonts-body)", "var(--font-geist-sans)", ...fontFamily.sans],
        heading: ["var(--theme-fonts-heading)", "var(--font-geist-sans)", ...fontFamily.sans],
        "theme-mono": ["var(--theme-fonts-monospace)", "var(--font-geist-mono)", ...fontFamily.mono],
      },
      spacing: {
        xs: "var(--theme-spacing-xs)",
        sm: "var(--theme-spacing-sm)",
        md: "var(--theme-spacing-md)",
        lg: "var(--theme-spacing-lg)",
        xl: "var(--theme-spacing-xl)",
      },
    },
  },
} satisfies Config;
