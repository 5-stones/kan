import defaultTheme from './default.json';

export type Theme = typeof defaultTheme;

export const builtInThemes = {
  default: defaultTheme,
};

export type BuiltInThemeName = keyof typeof builtInThemes;

export const getTheme = (name: BuiltInThemeName = 'default'): Theme => {
  return builtInThemes[name];
};

export default defaultTheme;
