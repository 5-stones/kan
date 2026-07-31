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
        primary: "rgb(var(--theme-colors-primary-rgb, 59 130 246) / <alpha-value>)",
        secondary: "rgb(var(--theme-colors-secondary-rgb, 16 185 129) / <alpha-value>)",
        // Dedicated (non-shared) neutral tokens, distinct from the app's own
        // light-*/dark-* scale, which reuses shade numbers for unrelated
        // roles (e.g. light-300 is both "border" and "list background" in
        // different components) and can't safely be theme-driven directly.
        background: "var(--theme-colors-light-background, #fcfcfc)",
        backgroundDark: "var(--theme-colors-dark-background, #161616)",
        surface: "var(--theme-colors-light-surface, #f8f8f8)",
        surfaceDark: "var(--theme-colors-dark-surface, #1c1c1c)",
        card: "var(--theme-colors-light-card, #fcfcfc)",
        cardDark: "var(--theme-colors-dark-card, #282828)",
        text: "var(--theme-colors-light-text, #171717)",
        textDark: "var(--theme-colors-dark-text, #e5e7eb)",
        textMuted: "var(--theme-colors-light-textMuted, #8f8f8f)",
        textMutedDark: "var(--theme-colors-dark-textMuted, #707070)",
        border: "var(--theme-colors-light-border, #dbdbdb)",
        borderDark: "var(--theme-colors-dark-border, #282828)",
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
