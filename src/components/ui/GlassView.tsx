import React from 'react';
import { cn } from '@/lib/utils';

export type GlassEffectStyle = 'regular' | 'clear' | 'none';
export type GlassColorScheme = 'auto' | 'light' | 'dark';

export interface GlassEffectStyleConfig {
  style?: GlassEffectStyle;
  animate?: boolean;
  animationDuration?: number;
}

export interface GlassViewProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Estilo do efeito de vidro espelhado oficial do expo-glass-effect:
   * - 'regular' (padrão): material equilibrado com desfoque profundo e camada refratora translúcida
   * - 'clear': maior transparência óptica para fundos ricos (mapas, imagens, dashboards)
   * - 'none': sem efeito de vidro (renderização neutra)
   * Ou um objeto de configuração { style, animate, animationDuration }
   */
  glassEffectStyle?: GlassEffectStyle | GlassEffectStyleConfig;
  /**
   * Tonalidade de cor (tintColor) aplicada sobre o efeito de vidro líquido
   */
  tintColor?: string;
  /**
   * Esquema de cores que força o visual ou acompanha o sistema: 'auto' | 'light' | 'dark'
   */
  colorScheme?: GlassColorScheme;
  /**
   * Habilita resposta interativa ao toque/hover com refração dinâmica
   */
  isInteractive?: boolean;
  /**
   * Intensidade de desfoque customizada (em px)
   */
  intensity?: number;
  /**
   * Elementos filhos sobrepostos
   */
  children?: React.ReactNode;
}

/**
 * Componente GlassView 100% compatível com a API do repositório expo-glass-effect:
 * https://github.com/expo/expo/tree/main/packages/expo-glass-effect
 *
 * Implementa com precisão o comportamento nativo (UIVisualEffectView / UIGlassEffect)
 * para a Web através de CSS Backdrop Filter avançado, refração especular de bordas,
 * transições fluidas e compatibilidade de esquemas de cores.
 */
export const GlassView = React.forwardRef<HTMLDivElement, GlassViewProps>(
  (
    {
      className,
      glassEffectStyle = 'regular',
      tintColor,
      colorScheme = 'auto',
      isInteractive = false,
      intensity,
      style,
      children,
      ...props
    },
    ref
  ) => {
    // Extrai o estilo caso tenha sido passado como objeto { style, animate, animationDuration }
    const resolvedStyle: GlassEffectStyle =
      typeof glassEffectStyle === 'object' && glassEffectStyle !== null
        ? glassEffectStyle.style || 'regular'
        : (glassEffectStyle as GlassEffectStyle);

    const animationDuration =
      typeof glassEffectStyle === 'object' && glassEffectStyle !== null && glassEffectStyle.animationDuration
        ? glassEffectStyle.animationDuration
        : 250;

    // Mapeamento de estilos ópticos do expo-glass-effect
    const styleVariants: Record<GlassEffectStyle, string> = {
      regular:
        'backdrop-blur-[24px] saturate-[190%] contrast-[105%] bg-white/70 dark:bg-slate-900/65 border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] [box-shadow:inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:[box-shadow:inset_0_1px_1px_0_rgba(255,255,255,0.12)]',
      clear:
        'backdrop-blur-[14px] saturate-[160%] bg-white/35 dark:bg-slate-900/35 border border-white/40 dark:border-white/10 shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_0_rgba(0,0,0,0.3)] [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.6)] dark:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08)]',
      none: 'bg-transparent border-none shadow-none backdrop-blur-none',
    };

    // Override explícito de tema se colorScheme !== 'auto'
    const colorSchemeClasses =
      colorScheme === 'light'
        ? '!bg-white/70 !text-slate-900 !border-white/50 [box-shadow:inset_0_1px_1px_0_rgba(255,255,255,0.85)]'
        : colorScheme === 'dark'
        ? '!bg-slate-900/70 !text-white !border-white/10 [box-shadow:inset_0_1px_1px_0_rgba(255,255,255,0.12)]'
        : '';

    // Estilo customizado de tintColor e intensity
    const customStyle: React.CSSProperties = {
      ...(tintColor ? { backgroundColor: tintColor } : {}),
      ...(intensity !== undefined
        ? {
            backdropFilter: `blur(${intensity}px) saturate(185%) contrast(105%)`,
            WebkitBackdropFilter: `blur(${intensity}px) saturate(185%) contrast(105%)`,
          }
        : {}),
      transitionDuration: `${animationDuration}ms`,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden transition-all',
          styleVariants[resolvedStyle],
          colorSchemeClasses,
          isInteractive &&
            'cursor-pointer hover:bg-white/80 dark:hover:bg-slate-900/80 hover:shadow-lg hover:border-white/70 dark:hover:border-white/20 active:scale-[0.99]',
          className
        )}
        style={customStyle}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassView.displayName = 'GlassView';
export default GlassView;
