import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type FontSize = 'small' | 'default' | 'large' | 'extra';
type AnimationIntensity = 'none' | 'subtle' | 'default';
type GlowIntensity = 'none' | 'subtle' | 'moderate';

interface ThemeSettings {
  theme: Theme;
  fontSize: FontSize;
  animationIntensity: AnimationIntensity;
  glowIntensity: GlowIntensity;
}

interface ThemeContextType extends ThemeSettings {
  toggleTheme: () => void;
  setFontSize: (size: FontSize) => void;
  setAnimationIntensity: (intensity: AnimationIntensity) => void;
  setGlowIntensity: (intensity: GlowIntensity) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '14px',
  default: '16px',
  large: '18px',
  extra: '20px',
};

function getStoredSettings(): ThemeSettings {
  if (typeof window === 'undefined') {
    return { theme: 'dark', fontSize: 'default', animationIntensity: 'default', glowIntensity: 'subtle' };
  }
  
  const savedTheme = localStorage.getItem('theme') as Theme;
  const savedFontSize = localStorage.getItem('fontSize') as FontSize;
  const savedAnimations = localStorage.getItem('animationIntensity') as AnimationIntensity;
  const savedGlow = localStorage.getItem('glowIntensity') as GlowIntensity;
  
  return {
    theme: savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    fontSize: savedFontSize || 'default',
    animationIntensity: savedAnimations || 'default',
    glowIntensity: savedGlow || 'subtle',
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(getStoredSettings);

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Apply theme
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);
    localStorage.setItem('theme', settings.theme);
    
    // Apply font size
    root.style.setProperty('--base-font-size', FONT_SIZE_MAP[settings.fontSize]);
    localStorage.setItem('fontSize', settings.fontSize);
    
    // Apply animation classes
    root.classList.remove('animations-none', 'animations-subtle', 'animations-default');
    root.classList.add(`animations-${settings.animationIntensity}`);
    localStorage.setItem('animationIntensity', settings.animationIntensity);
    
    // Apply glow classes
    root.classList.remove('glow-none', 'glow-subtle', 'glow-moderate');
    root.classList.add(`glow-${settings.glowIntensity}`);
    localStorage.setItem('glowIntensity', settings.glowIntensity);
  }, [settings]);

  const toggleTheme = () => {
    setSettings(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  };

  const setFontSize = (fontSize: FontSize) => {
    setSettings(prev => ({ ...prev, fontSize }));
  };

  const setAnimationIntensity = (animationIntensity: AnimationIntensity) => {
    setSettings(prev => ({ ...prev, animationIntensity }));
  };

  const setGlowIntensity = (glowIntensity: GlowIntensity) => {
    setSettings(prev => ({ ...prev, glowIntensity }));
  };

  return (
    <ThemeContext.Provider value={{ 
      ...settings, 
      toggleTheme, 
      setFontSize, 
      setAnimationIntensity, 
      setGlowIntensity 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
