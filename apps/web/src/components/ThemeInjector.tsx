import React from "react";
import { env } from "next-runtime-env";
import { builtInThemes, getTheme, BuiltInThemeName } from "~/themes";

interface ThemeInjectorProps {
  themeId?: string;
  /** Base CSS from a selected custom theme record */
  themeCss?: string | null;
  /** Colors/fonts/spacing from a selected custom theme record */
  themeVariables?: Record<string, any> | null;
  workspaceOverrides?: Record<string, any> | null;
  templateOverrides?: Record<string, any> | null;
  boardOverrides?: Record<string, any> | null;
  /**
   * CSS selector the variables are written to. Defaults to `:root` for the
   * workspace-wide theme. Board/card-level themes should scope to the
   * dashboard content container (`#dashboard-content`) so they don't bleed
   * into persistent chrome (sidebar, workspace icon) that lives outside it.
   */
  scope?: string;
}

const isObject = (item: any) => {
  return item && typeof item === "object" && !Array.isArray(item);
};

const deepMerge = (target: any, ...sources: any[]): any => {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
};

function hexToRgbChannels(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = match[1]!;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function objectToCssVariables(obj: Record<string, any>, prefix = ""): string {
  let css = "";
  for (const key in obj) {
    if (key === "css") continue; // Handle css separately as raw CSS

    const value = obj[key];
    const cssKey = prefix ? `${prefix}-${key}` : key;
    if (isObject(value)) {
      css += objectToCssVariables(value, cssKey);
    } else {
      css += `--theme-${cssKey}: ${value};\n`;
    }
  }
  return css;
}

export function ThemeInjector({
  themeId,
  themeCss,
  themeVariables,
  workspaceOverrides,
  templateOverrides,
  boardOverrides,
  scope = ":root",
}: ThemeInjectorProps) {
  // Only inject variables when a theme has actually been assigned/customized
  // at this level. Otherwise skip entirely (even at `:root`) so every
  // `bg-dark-*`/`bg-light-*` token falls back to its plain hardcoded value
  // instead of the built-in default theme's light-mode-oriented colors
  // silently bleeding into dark mode for installs that never picked a theme.
  const hasOwnContent =
    Boolean(themeId) ||
    Boolean(themeCss) ||
    Boolean(themeVariables && Object.keys(themeVariables).length > 0) ||
    Boolean(workspaceOverrides && Object.keys(workspaceOverrides).length > 0) ||
    Boolean(templateOverrides && Object.keys(templateOverrides).length > 0) ||
    Boolean(boardOverrides && Object.keys(boardOverrides).length > 0);

  if (!hasOwnContent) return null;

  const defaultThemeId = env("NEXT_PUBLIC_DEFAULT_THEME") || "default";

  // Only load a built-in theme's variables when the themeId matches a built-in key.
  // Custom DB themes supply their variables via `themeVariables` and raw CSS via `themeCss` instead.
  const builtInKey = (themeId && themeId in builtInThemes)
    ? (themeId as BuiltInThemeName)
    : (defaultThemeId in builtInThemes ? (defaultThemeId as BuiltInThemeName) : "default");

  const baseTheme = JSON.parse(JSON.stringify(getTheme(builtInKey)));

  const mergedTheme = deepMerge(
    baseTheme,
    themeVariables || {},
    workspaceOverrides || {},
    templateOverrides || {},
    boardOverrides || {},
  );

  let cssVariables = objectToCssVariables(mergedTheme);

  // Tailwind's opacity modifier (e.g. `bg-primary/10`) needs the color as
  // space-separated rgb channels rather than the hex string used elsewhere.
  for (const key of ["primary", "secondary"] as const) {
    const rgb = hexToRgbChannels(mergedTheme.colors?.[key]);
    if (rgb) cssVariables += `--theme-colors-${key}-rgb: ${rgb};\n`;
  }

  // Build raw CSS: custom theme base first, then cascading overrides
  let rawCss = "";
  if (themeCss) rawCss += themeCss + "\n";
  if (workspaceOverrides?.css) rawCss += workspaceOverrides.css + "\n";
  if (templateOverrides?.css) rawCss += templateOverrides.css + "\n";
  if (boardOverrides?.css) rawCss += boardOverrides.css + "\n";

  return (
    <style dangerouslySetInnerHTML={{
      __html: `${scope} {\n${cssVariables}}\n\n${rawCss}`,
    }} />
  );
}
