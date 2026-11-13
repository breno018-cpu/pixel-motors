import { useState, forwardRef, useRef, useLayoutEffect, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { PixelLoomMark } from '@/components/brand/PixelLoomLogo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MobileBottomNav } from './MobileBottomNav';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse';
import { SIDEBAR_GROUPS, type SidebarMenuItem as MenuItem } from '@/lib/sidebarMenu';

// ForwardRef wrapper for Link to fix Tooltip ref warning
const ForwardedLink = forwardRef<HTMLAnchorElement, React.ComponentProps<typeof Link>>(
  (props, ref) => <Link ref={ref} {...props} />
);
ForwardedLink.displayName = 'ForwardedLink';

// Persistência estática da rolagem do menu lateral entre trocas de rota e remontagens de tela
let persistedSidebarScrollTop = 0;
let persistedMobileSidebarScrollTop = 0;
const SIDEBAR_SCROLL_STORAGE_KEY = 'pixel_motors_sidebar_scroll_top';

export function Sidebar() {
  const { collapsed, setCollapsed, toggleCollapsed } = useSidebarCollapse();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { profile, roles, userStore, isAdmin, canCreateSales, signOut } = useAuth();
  const { visibleItems } = useSidebarConfig();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const desktopNavRef = useRef<HTMLElement | null>(null);
  const mobileNavRef = useRef<HTMLElement | null>(null);

  // Restaura a posição da rolagem exatamente onde o usuário deixou, sem pular para o topo
  const restoreSidebarScroll = () => {
    let target = persistedSidebarScrollTop;
    if (target <= 0 && typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY);
        if (saved) target = Number(saved);
      } catch {}
    }
    if (target > 0 && desktopNavRef.current) {
      desktopNavRef.current.scrollTop = target;
    }
  };

  useLayoutEffect(() => {
    restoreSidebarScroll();
    const frameId = requestAnimationFrame(restoreSidebarScroll);
    const t1 = setTimeout(restoreSidebarScroll, 25);
    const t2 = setTimeout(restoreSidebarScroll, 100);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [location.pathname, collapsed, visibleItems.length]);

  useEffect(() => {
    if (mobileOpen && mobileNavRef.current && persistedMobileSidebarScrollTop > 0) {
      mobileNavRef.current.scrollTop = persistedMobileSidebarScrollTop;
    }
  }, [mobileOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast({
        title: "Sessão encerrada",
        description: "Você foi desconectado com sucesso.",
      });
      navigate('/auth');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: "Não foi possível encerrar a sessão.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getRoleBadge = () => {
    if (roles.includes('admin')) return { label: 'Admin', color: 'bg-sidebar-primary/20 text-sidebar-primary' };
    if (roles.includes('gerente')) return { label: 'Gerente', color: 'bg-success/20 text-success' };
    if (roles.includes('vendedor_plus')) return { label: 'Vendedor +', color: 'bg-warning/20 text-warning' };
    if (roles.includes('vendedor_externo')) return { label: 'Vendedor ++', color: 'bg-warning/20 text-warning' };
    if (roles.includes('vendedor')) return { label: 'Vendedor', color: 'bg-warning/20 text-warning' };
    if (roles.includes('revendedor')) return { label: 'Revendedor', color: 'bg-accent/20 text-accent' };
    return { label: 'Visualizador', color: 'bg-muted text-muted-foreground' };
  };

  const roleBadge = getRoleBadge();

  const handleNavClick = (path: string) => {
    if (desktopNavRef.current) {
      const top = desktopNavRef.current.scrollTop;
      persistedSidebarScrollTop = top;
      try {
        sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(top));
      } catch {}
    }
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const menuItems = visibleItems;

  const NavItem = ({ item }: { item: MenuItem }) => {
    const isActive = location.pathname === item.path;
    const button = (
      <Button
        variant="ghost"
        onClick={() => handleNavClick(item.path)}
        className={cn(
          "w-full max-w-full min-w-0 overflow-hidden justify-start gap-2.5 h-9 px-2 rounded-lg text-white hover:text-white hover:bg-white/10 font-medium text-xs btn-glow group transition-all",
          collapsed && !isMobile && "justify-center px-0 w-9 h-9 mx-auto",
          isActive && "bg-white/15 text-white font-semibold shadow-xs ring-1 ring-white/20"
        )}
      >
        <div className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all shadow-xs",
          isActive 
            ? "bg-primary text-white ring-1 ring-white/30" 
            : "bg-white/10 text-white border border-white/15 group-hover:bg-white/20 group-hover:text-white"
        )}>
          <item.icon className="w-3.5 h-3.5 shrink-0 text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
        </div>
        {(!collapsed || isMobile) && (
          <span className="truncate min-w-0 flex-1 text-left text-xs text-white" title={item.label}>
            {item.label}
          </span>
        )}
      </Button>
    );

    if (collapsed && !isMobile) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-card border-border">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex flex-col h-full w-full max-w-full overflow-hidden", mobile ? "bg-sidebar" : "")}>
      {/* Store Header */}
      <div className="flex items-center h-14 px-3 border-b border-sidebar-border bg-sidebar-accent/20 w-full max-w-full overflow-hidden">
        <div className={cn("flex items-center gap-2.5 w-full max-w-full min-w-0 overflow-hidden", collapsed && !mobile && "justify-center")}>
          <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-zinc-950/80 border border-zinc-700/60 shadow-xs">
            <PixelLoomMark size={24} variant="default" />
          </div>
          {(!collapsed || mobile) && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-display font-bold text-xs tracking-tight text-white">PIXEL</span>
                <span className="font-display font-bold text-xs tracking-wider text-red-500">MOTORS</span>
              </div>
              <p
                className="text-[10px] text-sidebar-foreground/75 truncate block w-full max-w-full font-medium"
                title={userStore?.name || (isAdmin ? 'Todas as Unidades' : 'Operação Comercial')}
              >
                {userStore?.name || (isAdmin ? 'Todas as Unidades' : 'Operação Comercial')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      {(!collapsed || mobile) && profile && (
        <div className="p-2.5 border-b border-sidebar-border w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-2.5 w-full min-w-0 overflow-hidden">
            <div className="w-8 h-8 rounded-full border border-sidebar-primary/20 bg-sidebar-accent flex items-center justify-center shrink-0">
              <span className="text-sidebar-foreground/80 font-medium text-xs">
                {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-medium text-sidebar-foreground/90 truncate block w-full max-w-full" title={profile.full_name || ''}>
                {profile.full_name}
              </p>
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 truncate max-w-full",
                roleBadge.color
              )}>
                {roleBadge.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        ref={mobile ? mobileNavRef : desktopNavRef}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          if (mobile) {
            persistedMobileSidebarScrollTop = top;
          } else {
            persistedSidebarScrollTop = top;
            try {
              sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(top));
            } catch {}
          }
        }}
        className="flex-1 p-2 space-y-2 overflow-y-auto w-full max-w-full overflow-x-hidden"
      >
        {SIDEBAR_GROUPS.map((group) => {
          const items = menuItems.filter((i) => i.group === group.key);
          if (items.length === 0) return null;
          return (
            <div key={group.key} className="space-y-0.5 w-full max-w-full overflow-hidden">
              {(!collapsed || mobile) && (
                <p className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/35 truncate">
                  {group.label}
                </p>
              )}
              {items.map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5 w-full max-w-full overflow-hidden">
        {collapsed && !mobile ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={toggleTheme}
                className="w-9 h-9 mx-auto justify-center px-0 text-white hover:text-white hover:bg-white/10 btn-glow"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0 text-amber-300" /> : <Moon className="w-4 h-4 shrink-0 text-sky-300" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-card border-border">
              {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={toggleTheme}
            className="w-full max-w-full min-w-0 overflow-hidden justify-start gap-2.5 h-9 px-2 text-white hover:text-white hover:bg-white/10 font-normal text-xs btn-glow"
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-white/10 border border-white/15">
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 shrink-0 text-amber-300" /> : <Moon className="w-3.5 h-3.5 shrink-0 text-sky-300" />}
            </div>
            <span className="truncate min-w-0 flex-1 text-left text-white">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
          </Button>
        )}
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            {collapsed && !mobile ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-9 h-9 mx-auto justify-center px-0 text-rose-400 hover:text-rose-300 hover:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-card border-border">
                  Sair
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                className="w-full max-w-full min-w-0 overflow-hidden justify-start gap-2.5 h-9 px-2 text-rose-400 hover:text-rose-300 hover:bg-destructive/10 font-normal text-xs"
              >
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-rose-500/10 border border-rose-500/20">
                  <LogOut className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                </div>
                <span className="truncate min-w-0 flex-1 text-left text-rose-400">Sair</span>
              </Button>
            )}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sair do sistema</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja sair? Você precisará fazer login novamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoggingOut}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleLogout} 
                disabled={isLoggingOut}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoggingOut ? 'Saindo...' : 'Sair'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* PixelLoom Credit */}
      {(!collapsed || mobile) && (
        <div className="p-3 border-t border-sidebar-border">
          <p className="text-[10px] text-sidebar-foreground/30 text-center">
            por <span className="text-white/70">PixelLoom</span>
          </p>
        </div>
      )}
    </div>
  );

  // Mobile: hamburger + Sheet
  if (isMobile) {
    return (
      <>
        {/* Mobile top bar trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="fixed top-2 left-2 z-50 h-10 w-10 bg-sidebar text-white rounded-lg shadow-lg border border-sidebar-border"
        >
          <Menu className="w-5 h-5 text-white" />
        </Button>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-[280px] bg-sidebar border-sidebar-border">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu de Navegação</SheetTitle>
            </SheetHeader>
            <SidebarContent mobile />
          </SheetContent>
        </Sheet>

        {/* Barra de navegação inferior com suporte a operação por 1 polegar em mobile */}
        <MobileBottomNav onOpenMenu={() => setMobileOpen(true)} />
      </>
    );
  }

  // Desktop: fixed sidebar com expo-glass-sidebar
  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen expo-glass-sidebar transition-all duration-200 z-50 flex flex-col",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <SidebarContent />
      
      {/* Collapse Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>
    </aside>
  );
}
