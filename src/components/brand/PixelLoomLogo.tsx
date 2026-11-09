import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
  size?: number;
  /** Variante: 'default' (Cromado + Vermelho Racing) | 'white' (Monocromático Branco Puro) | 'red' | 'dark' */
  variant?: 'default' | 'light' | 'white' | 'dark' | 'red';
  /** Conceito do design: 'blade' (padrão - lâminas aerodinâmicas) | 'crest' (escudo moderno) | 'apex' (dupla asa) */
  concept?: 'blade' | 'crest' | 'apex';
}

/**
 * CONCEITO 1: AERO BLADE (Design Automotivo de Alta Performance)
 * Linhas puras de velocidade inspiradas nas montadoras modernas (Aston Martin, Porsche GT, AMG).
 * Monograma aerodinâmico "P" em lâminas chanfradas a 18° com aleta inferior de aceleração em Vermelho Racing.
 * 100% vetorial, limpo, sem círculos, sem mira, sem ruído.
 */
export function AeroBladeMark({ className, size = 44, variant = 'default' }: LogoMarkProps) {
  const isWhite = variant === 'white' || variant === 'light';
  const isDark = variant === 'dark';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none transition-transform duration-200 hover:scale-[1.03]', className)}
      role="img"
      aria-label="Logo Pixel Motors"
    >
      <defs>
        {/* Gradiente Cromado / Titânio Polido */}
        <linearGradient id="bladeChrome" x1="20" y1="16" x2="84" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>

        {/* Gradiente Vermelho Racing de Performance */}
        <linearGradient id="bladeRacingRed" x1="45" y1="56" x2="88" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#B91C1C" />
        </linearGradient>

        {/* Sombra de profundidade sutil */}
        <filter id="bladeShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.35" />
        </filter>
      </defs>

      <g filter={!isWhite ? 'url(#bladeShadow)' : undefined}>
        {/* 1. HASTE AERODINÂMICA INCLINADA A 18° (Pilar de sustentação em Titânio) */}
        <path
          d="M26 84 L46 16 L35 16 L15 84 Z"
          fill={isWhite ? '#FFFFFF' : isDark ? '#1E293B' : 'url(#bladeChrome)'}
        />

        {/* 2. ARCO AEROFÓLIO SUPERIOR (Asa em formato de loop com chanfro de velocidade) */}
        <path
          d="M48 16 L76 16 C85 16 89 21 86 32 L81 48 C78 58 71 62 60 62 L32 62 L36 49 L58 49 C64 49 68 47 70 41 L73 31 C74 27 72 25 67 25 L45 25 Z"
          fill={isWhite ? '#FFFFFF' : isDark ? '#334155' : 'url(#bladeChrome)'}
        />

        {/* 3. LÂMINA RACING VERMELHA DE ALTA PERFORMANCE (Acento de velocidade aerodinâmica) */}
        <path
          d="M44 69 L78 69 L73 84 L39 84 Z"
          fill={isWhite ? '#FFFFFF' : 'url(#bladeRacingRed)'}
          fillOpacity={isWhite ? '0.85' : '1'}
        />

        {/* 4. TRAÇO DE FLUXO HIPERVELOZ (Speed Slash central) */}
        <path
          d="M82 69 L88 69 L84 84 L78 84 Z"
          fill={isWhite ? '#FFFFFF' : '#DC2626'}
          fillOpacity={isWhite ? '0.6' : '0.9'}
        />
      </g>
    </svg>
  );
}

/**
 * CONCEITO 2: APEX CREST (Escudo Moderno Minimalista)
 * Inspirado nos escudos modernos das montadoras europeias.
 */
export function ApexCrestMark({ className, size = 44, variant = 'default' }: LogoMarkProps) {
  const isWhite = variant === 'white' || variant === 'light';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none transition-transform duration-200 hover:scale-[1.03]', className)}
      role="img"
      aria-label="Escudo Apex Pixel Motors"
    >
      <defs>
        <linearGradient id="apexGrad" x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>

      {/* Escudo facetado limpo */}
      <path
        d="M50 10 L85 24 L76 74 L50 92 L24 74 L15 24 Z"
        fill="none"
        stroke={isWhite ? '#FFFFFF' : 'url(#apexGrad)'}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />

      {/* Monograma P em V central */}
      <path
        d="M38 28 L48 28 L40 70 L30 70 Z"
        fill={isWhite ? '#FFFFFF' : '#E2E8F0'}
      />
      <path
        d="M48 28 L66 28 C73 28 76 32 74 38 L70 48 C68 54 62 57 54 57 L39 57 L42 47 L53 47 C57 47 60 45 61 41 L63 36 C64 33 62 31 58 31 L47 31 Z"
        fill={isWhite ? '#FFFFFF' : '#DC2626'}
      />
    </svg>
  );
}

export const PixelAutomotiveEmblem = AeroBladeMark;
export const PixelShieldBadge = AeroBladeMark;
export const PixelLoomMark = AeroBladeMark;
export const PixelMotorsMark = AeroBladeMark;

/**
 * Emblema Clássico "P." (PixelLoom / Pixel Motors)
 * Quadrado preto com o "P" estilizado em branco e o ponto vermelho em destaque
 * Idêntico ao badge do Painel Administrativo.
 */
export function PixelSquareMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Emblema PixelLoom"
    >
      {/* Letra P estilizada e chanfrada */}
      <path
        d="M26 18 H64 C76 18 84 26 84 38 C84 50 76 58 64 58 H44 V82 H26 V18 Z M44 33 V43 H62 C66 43 69 40 69 38 C69 36 66 33 62 33 H44 Z"
        fill="#FFFFFF"
      />
      {/* Ponto / Píxel Vermelho da Marca */}
      <rect x="68" y="66" width="16" height="16" rx="5" fill="#ED1C24" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  size?: number;
  showTagline?: boolean;
  vertical?: boolean;
  variant?: 'default' | 'light' | 'white' | 'dark' | 'red';
  concept?: 'blade' | 'crest';
}

/**
 * LOGOTIPO COMPLETO "PIXEL MOTORS" — PROJETADO DO ABSOLUTO ZERO
 * Estilo: Alta Performance Automotiva, Sólido, Moderno e Imponente.
 * Nada de círculos clichê, nada de miras ou teias. Linhas de corte puras de velocidade.
 */
export function PixelMotorsLogo({
  className,
  size = 40,
  showTagline = true,
  vertical = false,
  variant = 'default',
  concept = 'blade',
}: LogoProps) {
  const isWhite = variant === 'white';
  const isLight = variant === 'light' || isWhite;
  const isDark = variant === 'dark';

  const MarkComponent = concept === 'crest' ? ApexCrestMark : AeroBladeMark;

  return (
    <div
      className={cn(
        'flex items-center gap-3.5 select-none',
        vertical && 'flex-col gap-3 text-center',
        className
      )}
    >
      {/* Símbolo Automotivo Aero Blade */}
      <MarkComponent size={size} variant={variant} />

      {/* Bloco Tipográfico */}
      <div className={cn('min-w-0 flex flex-col justify-center', vertical && 'items-center text-center')}>
        <div className="flex items-center gap-2 leading-none">
          {/* "PIXEL" EM CORTE GEOMÉTRICO FORTE */}
          <span
            className={cn(
              'font-display font-black tracking-tight',
              isLight ? 'text-white' : isDark ? 'text-zinc-950' : 'text-foreground'
            )}
            style={{ fontSize: size * 0.54, letterSpacing: '-0.02em' }}
          >
            PIXEL
          </span>

          {/* "MOTORS" EM VERMELHO RACING AUTOMOTIVO COM PESO */}
          <span
            className={cn(
              'font-display font-extrabold tracking-[0.18em]',
              isWhite ? 'text-white' : 'text-red-600 dark:text-red-500'
            )}
            style={{ fontSize: size * 0.50 }}
          >
            MOTORS
          </span>
        </div>

        {/* Tagline Sóbria de Concessionária */}
        {showTagline && (
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                'text-[8px] font-bold tracking-[0.24em] uppercase',
                isLight ? 'text-zinc-300' : 'text-muted-foreground'
              )}
            >
              GESTÃO AUTOMOTIVA
            </span>
            <span className={cn('w-1 h-1 rounded-full', isLight ? 'bg-red-400' : 'bg-red-600')} />
            <span
              className={cn(
                'text-[8px] font-semibold tracking-[0.16em] uppercase',
                isLight ? 'text-zinc-400' : 'text-muted-foreground/80'
              )}
            >
              CONCESSIONÁRIAS
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const PixelLoomLogo = PixelMotorsLogo;
export default PixelMotorsLogo;
