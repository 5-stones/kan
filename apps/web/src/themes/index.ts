import defaultTheme from './default.json';

// `css`/`imports` aren't present on `default.json`, but theme files can
// optionally include them (see ThemeInjector, which reads them off the
// resolved base theme the same way it reads a custom DB theme's `css`/`imports`).
export type Theme = typeof defaultTheme & { css?: string; imports?: string };

// Theme files in this folder can be authored as .json, .yaml, or .yml
// (see the `yaml-loader` rule in next.config.js) — import and register
// new built-in themes here the same way as `default.json`.
export const builtInThemes = {
  default: defaultTheme,
};

export type BuiltInThemeName = keyof typeof builtInThemes;

export const getTheme = (name: BuiltInThemeName = 'default'): Theme => {
  return builtInThemes[name];
};

export default defaultTheme;
