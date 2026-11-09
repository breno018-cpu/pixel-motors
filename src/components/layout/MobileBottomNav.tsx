import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Car, 
  ShoppingCart, 
  ShieldCheck, 
  Menu,
  FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const canAccessAdmin = isAdmin || isManager;

  const currentPath = location.pathname;

  const navItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/',
      isActive: currentPath === '/',
    },
    {
      label: 'Estoque',
      icon: Car,
      path: '/vehicles',
      isActive: currentPath.startsWith('/vehicles'),
    },
    {
      label: 'Vendas',
      icon: ShoppingCart,
      path: '/sales',
      isActive: currentPath.startsWith('/sales'),
    },
    ...(canAccessAdmin
      ? [
          {
            label: 'Ala Master',
            icon: ShieldCheck,
            path: '/admin',
            isActive: currentPath.startsWith('/admin'),
            highlight: true,
          },
        ]
      : [
          {
            label: 'Contratos',
            icon: FileText,
            path: '/contracts',
            isActive: currentPath.startsWith('/contracts'),
          },
        ]),
  ];

  return (
    <nav 
      aria-label="Navegação rápida móvel"
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 expo-glass-bar z-40 flex items-center justify-around px-1 safe-area-bottom shadow-[0_-8px_32px_rgba(0,0,0,0.1)]"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            type="button"
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full py-1 gap-0.5 text-[10px] font-medium transition-colors select-none relative",
              item.isActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "p-1.5 rounded-xl transition-all",
                item.isActive && "bg-primary/10 shadow-xs",
                item.highlight && !item.isActive && "text-primary"
              )}
            >
              <Icon className={cn("w-5 h-5", item.isActive && "stroke-[2.5px]")} />
            </div>
            <span className="truncate max-w-[68px] leading-tight text-[10px]">
              {item.label}
            </span>
            {item.isActive && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary shadow-xs" />
            )}
          </button>
        );
      })}

      {/* Botão de Menu Completo */}
      <button
        onClick={onOpenMenu}
        type="button"
        className="flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground select-none"
      >
        <div className="p-1 rounded-xl transition-all">
          <Menu className="w-5 h-5" />
        </div>
        <span className="truncate max-w-[68px] leading-tight text-[10px]">Menu</span>
      </button>
    </nav>
  );
}
