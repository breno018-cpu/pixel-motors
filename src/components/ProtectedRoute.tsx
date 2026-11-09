import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog';
import { EulaDialog } from '@/components/legal/EulaDialog';
import { useEulaAcceptance } from '@/hooks/useEulaAcceptance';
import { LoginLoadingScreen } from '@/components/auth/LoginLoadingScreen';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'gerente' | 'revendedor' | 'vendedor' | 'vendedor_plus' | 'vendedor_externo' | 'visualizador';
  permission?: string;
  allowedRoles?: Array<'admin' | 'gerente' | 'revendedor' | 'vendedor' | 'vendedor_plus' | 'vendedor_externo' | 'visualizador'>;
}

export function ProtectedRoute({ children, requiredRole, allowedRoles, permission }: ProtectedRouteProps) {
  const { user, profile, roles, can, signOut, isLoading, isDataReady, mustChangePassword, clearMustChangePassword } = useAuth();
  const location = useLocation();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const { needsAcceptance, isChecking, markAccepted } = useEulaAcceptance();

  // Bloqueio de colaborador desligado/demitido com credenciais revogadas
  if (profile && profile.is_active === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center p-6 rounded-xl border border-destructive/40 bg-destructive/5 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Acesso Revogado / Desativado
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Suas credenciais e acessos operacionais a este sistema foram desativados pela concessionária devido a encerramento contratual.
            Para dúvidas ou documentação de rescisão (TRCT), favor contatar o setor de Recursos Humanos.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut()}
            className="text-xs border-destructive/30 hover:bg-destructive/10"
          >
            Encerrar Sessão & Voltar ao Login
          </Button>
        </div>
      </div>
    );
  }

  // Sempre reabrir o diálogo quando mustChangePassword mudar para true
  useEffect(() => {
    if (mustChangePassword) {
      setPasswordDialogOpen(true);
    }
  }, [mustChangePassword]);

  // Timeout de segurança: se isLoading demorar mais de 1.5s, libera a visualização
  const [authTimedOut, setAuthTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAuthTimedOut(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const needsInitialData = Boolean(user && !isDataReady && roles.length === 0);

  if ((isLoading || needsInitialData) && !authTimedOut) {
    return <LoginLoadingScreen message="Inicializando sistema da concessionária..." />;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const isMasterUser = roles.includes('admin') || roles.includes('gerente') || roles.length === 0;
  const hasRequiredRole = requiredRole ? (isMasterUser || roles.includes(requiredRole)) : true;
  const hasAnyAllowedRole = allowedRoles ? (isMasterUser || allowedRoles.some((role) => roles.includes(role))) : true;

  const hasPermission = permission ? (isMasterUser || can(permission)) : true;

  if (!hasRequiredRole || !hasAnyAllowedRole || !hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            Acesso Negado
          </h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  // Mostrar diálogo de troca de senha obrigatória
  if (mustChangePassword) {
    return (
      <>
        {children}
        <ChangePasswordDialog
          open={passwordDialogOpen}
          onSuccess={() => {
            setPasswordDialogOpen(false);
            clearMustChangePassword();
          }}
        />
      </>
    );
  }

  return (
    <>
      {children}
      {!isChecking && needsAcceptance && (
        <EulaDialog open onAccepted={markAccepted} />
      )}
    </>
  );
}
