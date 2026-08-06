import React from "react";
import { env } from "next-runtime-env";
import { builtInThemes, Theme } from "~/themes";

interface ThemeInjectorProps {
  themeId?: string;
  /**
   * Extra themes loaded at runtime from `KAN_THEMES_DIR` (see `theme.runtime`
   * query), keyed by filename. Merged with the compiled-in `builtInThemes` so
   * a `themeId` can resolve to either.
   */
  extraBuiltInThemes?: Record<string, Theme> | null;
  /** Base CSS from a selected custom theme record */
  themeCss?: string | null;
  /**
   * Font/CSS `@import` statements (or bare URLs) from a selected custom theme
   * record, one per line. Kept separate from `themeCss` because `@import`
   * rules must be the first thing in a stylesheet, and `themeCss` is rendered
   * after the theme's CSS variable block.
   */
  themeImports?: string | null;
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
      // `css`/`imports` are handled separately as raw CSS/@import strings
      // (see rawCss/importsCss below) and read directly off `baseTheme` after
      // this merge runs — skip them here so a blank override (e.g. an
      // unfilled `{ css: "", imports: "" }` saved by the override forms)
      // doesn't clobber the base theme's own `css`/`imports` in place.
      if (key === "css" || key === "imports") continue;

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

// `@import` rules are only valid as the very first statements in a stylesheet,
// so entries from every level are collected and rendered as one block ahead of
// the CSS variables and raw CSS that follow.
function buildImportsCss(...sources: (string | null | undefined)[]): string {
  let css = "";
  for (const source of sources) {
    if (!source) continue;
    for (const line of source.split("\n")) {
      const entry = line.trim();
      if (!entry) continue;
      css += entry.startsWith("@import")
        ? `${entry.replace(/;?$/, ";")}\n`
        : `@import url("${entry}");\n`;
    }
  }
  return css;
}

function objectToCssVariables(obj: Record<string, any>, prefix = ""): string {
  let css = "";
  for (const key in obj) {
    if (key === "css" || key === "imports") continue; // Handled separately as raw CSS/@import statements

    const value = obj[key];
    const cssKey = prefix ? `${prefix}-${key}` : key;
    // Unset form fields save as "" rather than being omitted (see
    // formValuesToVariables), so a leaf can be blank without meaning
    // "override to nothing". A custom property that's *declared* empty
    // doesn't trigger var()'s fallback (only an undeclared one does), so
    // emitting `--theme-x: ;` here would break every consumer's fallback.
    // Skipping the declaration entirely lets the real fallback apply.
    if (value === "" || value === null || value === undefined) continue;
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
  extraBuiltInThemes,
  themeCss,
  themeImports,
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
    Boolean(themeImports) ||
    Boolean(themeVariables && Object.keys(themeVariables).length > 0) ||
    Boolean(workspaceOverrides && Object.keys(workspaceOverrides).length > 0) ||
    Boolean(templateOverrides && Object.keys(templateOverrides).length > 0) ||
    Boolean(boardOverrides && Object.keys(boardOverrides).length > 0);

  if (!hasOwnContent) return null;

  const defaultThemeId = env("NEXT_PUBLIC_DEFAULT_THEME") || "default";

  // Compiled-in themes (apps/web/src/themes) plus any loaded at runtime from
  // `KAN_THEMES_DIR`. Runtime themes win on key collisions since they're the
  // ones an operator is deliberately dropping in to override/extend the set.
  const allBuiltInThemes: Record<string, Theme> = {
    ...builtInThemes,
    ...(extraBuiltInThemes || {}),
  };

  // Only load a built-in theme's variables when the themeId matches a built-in key.
  // Custom DB themes supply their variables via `themeVariables` and raw CSS via `themeCss` instead.
  const builtInKey = (themeId && themeId in allBuiltInThemes)
    ? themeId
    : (defaultThemeId in allBuiltInThemes ? defaultThemeId : "default");

  const baseTheme = JSON.parse(JSON.stringify(allBuiltInThemes[builtInKey] ?? builtInThemes.default));

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

  // Build raw CSS: built-in base theme first, then custom theme, then cascading overrides
  let rawCss = "";
  if (baseTheme.css) rawCss += baseTheme.css + "\n";
  if (themeCss) rawCss += themeCss + "\n";
  if (workspaceOverrides?.css) rawCss += workspaceOverrides.css + "\n";
  if (templateOverrides?.css) rawCss += templateOverrides.css + "\n";
  if (boardOverrides?.css) rawCss += boardOverrides.css + "\n";

  const importsCss = buildImportsCss(
    baseTheme.imports,
    themeImports,
    workspaceOverrides?.imports,
    templateOverrides?.imports,
    boardOverrides?.imports,
  );

  return (
    <style dangerouslySetInnerHTML={{
      __html: `${importsCss}\n${scope} {\n${cssVariables}}\n\n${rawCss}`,
    }} />
  );
}
