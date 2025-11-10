import { useTheme } from '../app/context/ThemeContext';

export function useThemeStyles() {
  const { theme } = useTheme();
// Add this to your useThemeStyles hook or create a new theme file
const colors = {
  light: {
    primary: '#4d4fcaff',    // Indigo - Main brand color
    secondary: '#10B981',  // Emerald - Accent color
    accent: '#5a17f6ff',     // Violet - Action color
    background: '#FFFFFF',
    surface: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  dark: {
    primary: '#818CF8',    // Light Indigo
    secondary: '#34D399',  // Light Emerald
    accent: '#A78BFA',     // Light Violet
    background: '#0F172A',
    surface: '#1E293B',
    card: '#334155',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    border: '#334155',
    error: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    info: '#60A5FA',
  }
};  

  const currentColors = colors[theme];

  return {
    theme,
    colors: currentColors,
    isDark: theme === 'dark',
  };
}