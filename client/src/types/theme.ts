export type ColorMode = 'light' | 'dark' | 'system';

export type ThemeContextType = {
  mode: ColorMode;
  toggleColorMode: () => void;
};
