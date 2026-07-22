import React from "react";
import { env } from "next-runtime-env";
import { builtInThemes, getTheme, BuiltInThemeName } from "~/themes";

interface ThemeInjectorProps {
  themeId?: string;
  /** Base CSS from a selected custom theme record */
  themeCss?: string | null;
  workspaceOverrides?: Record<string, any> | null;
  templateOverrides?: Record<string, any> | null;
  boardOverrides?: Record<string, any> | null;
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
  workspaceOverrides,
  templateOverrides,
  boardOverrides,
}: ThemeInjectorProps) {
  const defaultThemeId = env("NEXT_PUBLIC_DEFAULT_THEME") || "default";

  // Only load a built-in theme's variables when the themeId matches a built-in key.
  // Custom DB themes supply their CSS via `themeCss` instead.
  const builtInKey = (themeId && themeId in builtInThemes)
    ? (themeId as BuiltInThemeName)
    : (defaultThemeId in builtInThemes ? (defaultThemeId as BuiltInThemeName) : "default");

  const baseTheme = JSON.parse(JSON.stringify(getTheme(builtInKey)));

  const mergedTheme = deepMerge(
    baseTheme,
    workspaceOverrides || {},
    templateOverrides || {},
    boardOverrides || {},
  );

  const cssVariables = objectToCssVariables(mergedTheme);

  // Build raw CSS: custom theme base first, then cascading overrides
  let rawCss = "";
  if (themeCss) rawCss += themeCss + "\n";
  if (workspaceOverrides?.css) rawCss += workspaceOverrides.css + "\n";
  if (templateOverrides?.css) rawCss += templateOverrides.css + "\n";
  if (boardOverrides?.css) rawCss += boardOverrides.css + "\n";

  return (
    <style dangerouslySetInnerHTML={{
      __html: `:root {\n${cssVariables}}\n\n${rawCss}`,
    }} />
  );
}
