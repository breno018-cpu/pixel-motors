import { ReactNode, useState, useEffect } from 'react';
import { Sun, Moon, Building2, ShieldAlert } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { useIsMobile } from '@/hooks/use-mobile';
import { StockSyncWatcher } from '@/components/sync/StockSyncWatcher';
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovalRequests } from '@/hooks/useApprovalRequests';
import { ApprovalCenterDialog } from '@/components/approvals/ApprovalCenterDialog';
import { AeroBladeMark } from '@/components/brand/PixelLoomLogo';
import { DealershipSegmentedBar } from '@/components/common/DealershipSegmentedBar';
import { DealershipBadge } from '@/contexts/DealershipScopeContext';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const { collapsed } = useSidebarCollapse();
  const { theme, toggleTheme } = useTheme();
  const { profile, roles, userStore, isAdmin, isManager } = useAuth();
  const { pendingCount } = useApprovalRequests();
  const hasManagementAccess = isAdmin || isManager;

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const roleLabel = roles.includes('admin')
    ? 'Admin'
    : roles.includes('gerente')
    ? 'Gerente'
    : roles.includes('vendedor_plus')
    ? 'Vendedor +'
    : roles.includes('vendedor_externo')
    ? 'Vendedor Ext.'
    : roles.includes('vendedor')
    ? 'Vendedor'
    : roles.includes('revendedor')
    ? 'Revendedor'
    : 'Membro';

  const userInitials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'DF';

  return (
    <div
      className={`min-h-screen bg-background flex flex-col antialiased w-full transition-[padding] duration-200 ${
        isMobile ? 'pl-0' : collapsed ? 'pl-16' : 'pl-56'
      }`}
    >
      <StockSyncWatcher />
      <Sidebar />
      
      {/* Top bar executiva com expo-glass-effect */}
      <header
        className={`fixed top-0 right-0 h-14 expo-glass-header z-40 flex items-center justify-between px-2.5 sm:px-6 transition-[left] duration-200 overflow-hidden ${
          isMobile ? 'left-0' : collapsed ? 'left-16' : 'left-56'
        }`}
      >
        {/* Lado Esquerdo: Identificação da Shineray Motos & Unidade */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-xl bg-card border border-border shadow-xs select-none">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 p-0.5 shadow-xs border border-primary/20">
              <AeroBladeMark size={18} variant="default" />
            </div>
            <div className="flex items-center gap-1 leading-none font-display font-black text-[11px] sm:text-xs tracking-tight">
              <span className="text-foreground">SHINERAY</span>
              <span className="text-primary font-extrabold tracking-wider">MOTOS</span>
            </div>
          </div>

          {/* Alternador Executivo de Concessionária (Arquitetura de Divisão) */}
          {hasManagementAccess ? (
            <DealershipSegmentedBar variant="header" className="hidden sm:inline-flex" />
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/60 border border-border/60 text-xs font-medium text-foreground">
              <DealershipBadge storeIdOrName={userStore?.id || userStore?.name} />
            </div>
          )}
        </div>

        {/* Lado Direito: Status, Alternador de Tema e Colaborador */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Botão da Central de Aprovação de Alçadas (Gestores) */}
          {hasManagementAccess && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setApprovalModalOpen(true)}
              className="relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              title="Central de Aprovações de Alçadas e Descontos"
            >
              <ShieldAlert className={`w-4 h-4 ${pendingCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shadow-xs">
                  {pendingCount}
                </span>
              )}
            </Button>
          )}

          {/* Indicador Online */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Online</span>
          </div>

          {/* Alternador de Tema Claro / Escuro */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </Button>

          {/* Badge do Usuário Logado */}
          {profile && (
            <div className="flex items-center gap-2 pl-1 border-l border-border/60">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-[11px] shrink-0 font-display">
                {userInitials}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-foreground leading-tight truncate max-w-[120px]">
                  {profile.full_name?.split(' ')[0] || 'Usuário'}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none">
                  {roleLabel}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>
      
      <main className="mt-14 flex-1 p-3 sm:p-5 lg:p-6 pb-20 md:pb-6 min-w-0 w-full">
        <div className="w-full max-w-[1600px] mx-auto min-w-0 animate-fade-in">
          {children}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-3 px-4 sm:px-6 pb-20 md:pb-3 border-t border-border/70 bg-background/50 w-full">
        <div className="w-full max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground/70 gap-2">
          <p>
            <span className="font-extrabold text-foreground/90 tracking-wide font-display">SHINERAY MOTOS</span> • Montes Claros &amp; Divinópolis
          </p>
          <p className="text-[10px]">
            Sistema de Vendas e Gestão de Concessionárias
          </p>
        </div>
      </footer>
      
      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Central de Aprovação de Alçadas */}
      <ApprovalCenterDialog open={approvalModalOpen} onOpenChange={setApprovalModalOpen} />
    </div>
  );
}
