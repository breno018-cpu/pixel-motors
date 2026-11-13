import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  User,
  Lock,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Save,
  Shield,
  Bell,
  Download,
  Database,
  Palette,
  Type,
  Sparkles,
  Car,
  Users,
  Key,
  Monitor,
  FileText,
  CheckCircle,
  LogOut,
  CreditCard,
  UserPlus,
  AlertTriangle,
  Building2,
  Store as StoreIcon,
  Landmark,
  Trash2,
  CloudDownload,
  Cloud,
  ShieldCheck,
  Truck,
  ArrowRight,
  ExternalLink,
  DollarSign,
  Activity,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { z } from 'zod';
import { ExportDialog } from '@/components/export/ExportDialog';
import { BankCredentialsManager } from '@/components/admin/BankCredentialsManager';
import { FinancingBanksManager } from '@/components/admin/FinancingBanksManager';
import { SidebarCustomizer } from '@/components/settings/SidebarCustomizer';
import { StockSyncSettings } from '@/components/settings/StockSyncSettings';
import { DeviceSecurityManager } from '@/components/settings/DeviceSecurityManager';
import { DealershipsSettingsManager } from '@/components/settings/DealershipsSettingsManager';
import { LogisticsSettingsManager } from '@/components/settings/LogisticsSettingsManager';
import { BrandLogoShowcase } from '@/components/brand/BrandLogoShowcase';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';

function BackupsList() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: backups, isLoading, refetch } = useQuery({
    queryKey: ['system-backups'],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('system-backups')
        .list('', { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      return data || [];
    },
  });

  const handleDownload = async (name: string) => {
    const { data, error } = await supabase.storage.from('system-backups').download(name);
    if (error || !data) {
      toast({
        title: 'Não foi possível baixar o backup',
        description: error?.message,
        variant: 'destructive',
      });
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (name: string) => {
    const confirmed = await confirm({
      title: 'Excluir Arquivo de Backup?',
      description: `Deseja realmente excluir o backup "${name}"? Essa ação não pode ser desfeita.`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;
    const { error } = await supabase.storage.from('system-backups').remove([name]);
    if (error) {
      toast({
        title: 'Erro ao excluir backup',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Backup excluído' });
    refetch();
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando backups...</p>;
  if (!backups || backups.length === 0)
    return <p className="text-xs text-muted-foreground">Nenhum backup salvo na nuvem.</p>;

  return (
    <div className="space-y-2 max-h-[200px] overflow-y-auto">
      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <Cloud className="w-3.5 h-3.5 text-primary" />
        Backups na Nuvem ({backups.length})
      </p>
      {backups.map((file) => (
        <div
          key={file.name}
          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
        >
          <span className="text-xs text-muted-foreground truncate flex-1">{file.name}</span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleDownload(file.name)}
              title="Baixar"
            >
              <CloudDownload className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => handleDelete(file.name)}
              title="Excluir"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Nova senha deve ter no mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter letra maiúscula')
      .regex(/[a-z]/, 'Deve conter letra minúscula')
      .regex(/[0-9]/, 'Deve conter número'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

type FontSize = 'small' | 'default' | 'large' | 'extra';
type AnimationIntensity = 'none' | 'subtle' | 'default';
type GlowIntensity = 'none' | 'subtle' | 'moderate';

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'stores';

  const {
    theme,
    toggleTheme,
    fontSize,
    setFontSize,
    animationIntensity,
    setAnimationIntensity,
    glowIntensity,
    setGlowIntensity,
  } = useTheme();
  const { profile, roles, isAdmin, hasElevatedAccess, userStore } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const next = new URLSearchParams(searchParams);
    next.set('tab', val);
    setSearchParams(next, { replace: true });
  };

  // Password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Notification states
  const [notifyStock, setNotifyStock] = useState(true);
  const [notifySales, setNotifySales] = useState(true);
  const [notifyPayments, setNotifyPayments] = useState(true);
  const [notifyContracts, setNotifyContracts] = useState(true);
  const [notifyBackup, setNotifyBackup] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Security states
  const [lockAfterAttempts, setLockAfterAttempts] = useState(true);
  const [auditLogs, setAuditLogs] = useState(true);

  // Export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const handlePasswordChange = async () => {
    setPasswordErrors({});

    const result = passwordSchema.safeParse({
      newPassword,
      confirmPassword,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        errors[err.path[0] as string] = err.message;
      });
      setPasswordErrors(errors);
      return;
    }

    setIsChangingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar senha',
        description: error.message,
      });
    } else {
      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua nova senha já está ativa.',
      });
      setNewPassword('');
      setConfirmPassword('');
    }

    setIsChangingPassword(false);
  };

  const getRoleLabel = () => {
    if (roles.includes('admin')) return 'Administrador Geral';
    if (roles.includes('gerente')) return 'Gerente de Loja';
    if (roles.includes('vendedor_plus')) return 'Consultor de Vendas Sênior';
    if (roles.includes('vendedor_externo')) return 'Consultor Regional';
    if (roles.includes('vendedor')) return 'Consultor Comercial';
    if (roles.includes('revendedor')) return 'Revendedor Parceiro';
    return 'Operador';
  };

  const fontSizeLabels: Record<FontSize, string> = {
    small: 'Pequeno (14px)',
    default: 'Padrão (16px)',
    large: 'Grande (18px)',
    extra: 'Extra (20px)',
  };

  const animationLabels: Record<AnimationIntensity, string> = {
    none: 'Desativado',
    subtle: 'Suave',
    default: 'Padrão',
  };

  const glowLabels: Record<GlowIntensity, string> = {
    none: 'Sem brilho',
    subtle: 'Sutil',
    moderate: 'Moderado',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full min-w-0 page-transition pb-12">
      {/* Header */}
      <PageHeader
        title="Painel de Configurações Master"
        description="Gestão centralizada das concessionárias, segurança de sessão única, bancos F&I, identidade e preferências."
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="animate-fade-in w-full min-w-0">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 w-full h-auto gap-1.5 p-1.5 bg-muted/50 rounded-2xl border">
          <TabsTrigger value="stores" className="gap-2 text-xs px-2.5 rounded-xl py-2 font-bold min-w-0 max-w-full overflow-hidden data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate min-w-0 flex-1">Lojas & Matriz</span>
          </TabsTrigger>
          <TabsTrigger value="logistics" className="gap-2 text-xs px-2.5 rounded-xl py-2 font-bold min-w-0 max-w-full overflow-hidden data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <Truck className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate min-w-0 flex-1">Logística & Frete</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 text-xs px-2.5 rounded-xl py-2 font-bold min-w-0 max-w-full overflow-hidden data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <Lock className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate min-w-0 flex-1">Segurança</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2 text-xs px-2.5 rounded-xl py-2 font-bold min-w-0 max-w-full overflow-hidden data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <User className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate min-w-0 flex-1">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2 text-xs px-2.5 rounded-xl py-2 font-bold min-w-0 max-w-full overflow-hidden data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <Palette className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate min-w-0 flex-1">Identidade</span>
          </TabsTrigger>
          <TabsTrigger value="banks" className="gap-2 text-xs px-2.5 rounded-xl py-2 font-bold min-w-0 max-w-full overflow-hidden data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <Landmark className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate min-w-0 flex-1">Bancos & F&I</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2 text-xs px-2.5 rounded-xl py-2 font-bold min-w-0 max-w-full overflow-hidden data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <Database className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate min-w-0 flex-1">Dados</span>
          </TabsTrigger>
          {hasElevatedAccess && (
            <TabsTrigger value="admin" className="gap-2 text-xs px-2.5 rounded-xl py-2 font-bold min-w-0 max-w-full overflow-hidden data-[state=active]:bg-card data-[state=active]:shadow-xs">
              <Shield className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate min-w-0 flex-1">Gestão</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* -------------------------------------------------------- */}
        {/* ABA 1: CONCESSIONÁRIAS & MATRIZ (FONTE ÚNICA DA VERDADE) */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="stores" className="space-y-4 mt-6">
          <DealershipsSettingsManager />
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 2: LOGÍSTICA, FROTAS & MÉTODOS DE TRANSPORTE         */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="logistics" className="space-y-4 mt-6">
          <LogisticsSettingsManager />
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 2: SEGURANÇA & SESSÃO ÚNICA (DISPOSITIVOS & COOKIES) */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="security" className="space-y-4 mt-6">
          <DeviceSecurityManager />

          <Card className="card-interactive rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Políticas de Proteção da Conta
              </CardTitle>
              <CardDescription className="text-xs">
                Controle de tentativas de acesso, isolamento de sessão e auditoria.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Bloqueio após Tentativas Falhas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bloquear conta temporariamente após 5 tentativas incorretas de login
                  </p>
                </div>
                <Switch checked={lockAfterAttempts} onCheckedChange={setLockAfterAttempts} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Logs de Auditoria em Tempo Real</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Registrar acessos, alterações cadastrais de lojas e geração de contratos
                  </p>
                </div>
                <Switch checked={auditLogs} onCheckedChange={setAuditLogs} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 3: PERFIL & SENHA DO USUÁRIO                         */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="profile" className="space-y-4 mt-6">
          <Card className="card-interactive rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Informações do Perfil Conectado
              </CardTitle>
              <CardDescription className="text-xs">Identificação do operador e vinculação oficial de loja</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-2xl font-black text-primary font-display">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-foreground truncate">{profile?.full_name || 'Operador'}</p>
                  <p className="text-xs text-muted-foreground truncate font-mono">{profile?.email}</p>
                  <div className="flex flex-wrap items-center gap-2.5 mt-2">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs font-bold gap-1">
                      <Shield className="w-3.5 h-3.5" />
                      {getRoleLabel()}
                    </Badge>
                    {userStore && (
                      <Badge variant="outline" className="text-xs font-semibold gap-1">
                        <StoreIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        {userStore.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card className="card-interactive rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                Alterar Senha de Acesso
              </CardTitle>
              <CardDescription className="text-xs">
                Mínimo 8 caracteres com maiúscula, minúscula e número
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-xs font-semibold">Nova Senha</Label>
                    <Input
                      id="newPassword"
                      type={showPasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`h-9 ${passwordErrors.newPassword ? 'border-destructive' : ''}`}
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-xs text-destructive">{passwordErrors.newPassword}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold">Confirmar Nova Senha</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPasswords ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`h-9 pr-9 ${passwordErrors.confirmPassword ? 'border-destructive' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordErrors.confirmPassword && (
                      <p className="text-xs text-destructive">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Requirements feedback */}
              <div className="bg-muted/40 rounded-xl p-3 space-y-1 border">
                <p className="text-xs font-bold text-foreground mb-1">Requisitos de Segurança:</p>
                {[
                  { label: 'Mínimo 8 caracteres', met: newPassword.length >= 8 },
                  { label: 'Letra maiúscula', met: /[A-Z]/.test(newPassword) },
                  { label: 'Letra minúscula', met: /[a-z]/.test(newPassword) },
                  { label: 'Número', met: /[0-9]/.test(newPassword) },
                  {
                    label: 'Senhas conferem',
                    met: confirmPassword.length > 0 && newPassword === confirmPassword,
                  },
                ].map((req, i) => (
                  <p
                    key={i}
                    className={`text-xs flex items-center gap-1.5 ${
                      req.met ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {req.met ? '•' : '○'} {req.label}
                  </p>
                ))}
              </div>

              <Button
                onClick={handlePasswordChange}
                disabled={isChangingPassword}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 font-bold shadow-sm shadow-primary/20"
              >
                {isChangingPassword ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Alterando...
                  </div>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Nova Senha
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 4: APARÊNCIA & IDENTIDADE VISUAL                     */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="appearance" className="space-y-6 mt-6">
          <BrandLogoShowcase />

          {/* Theme */}
          <Card className="card-interactive rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-primary" />
                ) : (
                  <Sun className="w-4 h-4 text-primary" />
                )}
                Tema da Interface
              </CardTitle>
              <CardDescription className="text-xs">Escolha entre modo escuro executivo ou claro</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Modo Escuro (Dark Mode)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {theme === 'dark' ? 'Tema escuro ativado com alto contraste' : 'Tema claro ativado'}
                  </p>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
              </div>
            </CardContent>
          </Card>

          {/* Font Size */}
          <Card className="card-interactive rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Type className="w-4 h-4 text-primary" />
                Escala de Tipografia
              </CardTitle>
              <CardDescription className="text-xs">Ajuste o tamanho do texto para leitura confortável</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={fontSize} onValueChange={(v) => setFontSize(v as FontSize)}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(fontSizeLabels) as FontSize[]).map((size) => (
                    <SelectItem key={size} value={size}>
                      {fontSizeLabels[size]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Animations */}
          <Card className="card-interactive rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Animações e Efeitos Visuais
              </CardTitle>
              <CardDescription className="text-xs">Controle as transições de tela e brilho</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-semibold mb-2 block">Intensidade das Animações</Label>
                <Select
                  value={animationIntensity}
                  onValueChange={(v) => setAnimationIntensity(v as AnimationIntensity)}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(animationLabels) as AnimationIntensity[]).map((intensity) => (
                      <SelectItem key={intensity} value={intensity}>
                        {animationLabels[intensity]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <Label className="text-xs font-semibold mb-2 block">Brilho dos Elementos em Vidro (Glow)</Label>
                <Select
                  value={glowIntensity}
                  onValueChange={(v) => setGlowIntensity(v as GlowIntensity)}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(glowLabels) as GlowIntensity[]).map((intensity) => (
                      <SelectItem key={intensity} value={intensity}>
                        {glowLabels[intensity]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <SidebarCustomizer />
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 5: BANCOS & CREDENCIAIS DE F&I                       */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="banks" className="space-y-4 mt-6">
          <Card className="border border-primary/20 bg-primary/5 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    Central Integrada de F&I e Bancos Homologados
                    <Badge variant="outline" className="text-[10px] bg-background border-primary/30 text-primary font-bold">
                      Sincronizado com Ala Master
                    </Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Os coeficientes bancários, tabelas de retorno e credenciais de integração são centralizados e abastecem as simulações em tempo real.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5 shrink-0 rounded-xl"
                onClick={() => navigate('/admin?tab=bancos')}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Gerenciar na Ala Master
              </Button>
            </div>
          </Card>

          <FinancingBanksManager />
          <BankCredentialsManager />
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 6: DADOS, BACKUPS & SINCRONIZAÇÃO                    */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="data" className="space-y-4 mt-6">
          <StockSyncSettings />

          <Card className="card-interactive rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                Assistente de Exportação de Dados
              </CardTitle>
              <CardDescription className="text-xs">
                Exporte relatórios executivos em Excel (XLSX) com metadados de auditoria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full h-11 font-bold shadow-sm shadow-primary/20"
                onClick={() => setExportDialogOpen(true)}
              >
                <FileText className="w-4 h-4 mr-2" />
                Abrir Assistente de Exportação
              </Button>
            </CardContent>
          </Card>

          <ExportDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} />

          <Card className="card-interactive rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Backup Contábil do Sistema
              </CardTitle>
              <CardDescription className="text-xs">
                Backups salvos automaticamente na nuvem e disponíveis para download
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-10 font-bold"
                onClick={async () => {
                  toast({
                    title: 'Iniciando backup...',
                    description: 'Gerando pacote e salvando na nuvem...',
                  });

                  try {
                    const [vehicles, contracts, resellers, storesData] = await Promise.all([
                      supabase.from('vehicles').select('*'),
                      supabase.from('contracts').select('*'),
                      supabase.from('resellers').select('*'),
                      supabase.from('stores').select('*'),
                    ]);

                    const backupData = {
                      vehicles: vehicles.data || [],
                      contracts: contracts.data || [],
                      resellers: resellers.data || [],
                      stores: storesData.data || [],
                      exported_at: new Date().toISOString(),
                      version: '9.0',
                    };

                    const jsonStr = JSON.stringify(backupData, null, 2);
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const fileName = `backup_dealflow_${new Date()
                      .toISOString()
                      .replace(/[:.]/g, '-')}.json`;

                    // Upload to cloud storage
                    const { error: uploadError } = await supabase.storage
                      .from('system-backups')
                      .upload(fileName, blob, {
                        contentType: 'application/json',
                        upsert: false,
                      });

                    if (uploadError) throw uploadError;

                    // Also download locally
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    link.click();
                    URL.revokeObjectURL(url);

                    toast({
                      title: 'Backup concluído com sucesso!',
                      description: 'Dados salvos na nuvem e baixados no computador.',
                    });
                  } catch (error) {
                    toast({
                      variant: 'destructive',
                      title: 'Erro no backup',
                      description:
                        error instanceof Error ? error.message : 'Não foi possível realizar o backup.',
                    });
                  }
                }}
              >
                <Database className="w-4 h-4 mr-2" />
                Realizar Backup Agora
              </Button>

              <BackupsList />
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 7: HUB DIRECIONADOR PARA ALA MASTER (SEM DUPLICIDADE)*/}
        {/* -------------------------------------------------------- */}
        {hasElevatedAccess && (
          <TabsContent value="admin" className="space-y-6 mt-6">
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card rounded-3xl shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold shadow-xs">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        Governança Mestra Centralizada
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                          Fonte Única da Verdade
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Para eliminar duplicidade de formulários e campos conflitantes, todas as regras mestras, contas e permissões foram centralizadas na Ala Master.
                      </CardDescription>
                    </div>
                  </div>

                  <Button
                    onClick={() => navigate('/admin')}
                    className="h-9 px-4 font-bold text-xs gap-2 rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20 shrink-0"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Abrir Painel Ala Master
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Abaixo você encontra atalhos diretos para as áreas de governança elevada da plataforma. Selecione o módulo desejado para ser direcionado instantaneamente:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
                  {/* Card 1: Usuários & Acessos */}
                  <div
                    onClick={() => navigate('/admin?tab=usuarios')}
                    className="p-4 rounded-2xl border border-border/70 hover:border-primary/40 bg-card hover:bg-primary/5 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                        Usuários & Acessos
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Gerenciamento de contas, vinculação de lojas, senhas temporárias e performance comercial.
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Cargos & Governança */}
                  <div
                    onClick={() => navigate('/admin?tab=cargos')}
                    className="p-4 rounded-2xl border border-border/70 hover:border-primary/40 bg-card hover:bg-primary/5 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                        Governança & Permissões (RBAC)
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Alçadas de desconto por cargo, visualização de margem de lucro e matriz de segurança.
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Catálogo & Chassi */}
                  <div
                    onClick={() => navigate('/admin?tab=catalogo')}
                    className="p-4 rounded-2xl border border-border/70 hover:border-primary/40 bg-card hover:bg-primary/5 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <Car className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                        Catálogo & Tabela de Preços
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Modelos homologados, tabela mestra, diretrizes de margem e decodificadores autônomos de chassi (VIN).
                      </p>
                    </div>
                  </div>

                  {/* Card 4: F&I & Bancos */}
                  <div
                    onClick={() => navigate('/admin?tab=bancos')}
                    className="p-4 rounded-2xl border border-border/70 hover:border-primary/40 bg-card hover:bg-primary/5 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                        F&I & Bancos Parceiros
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Coeficientes de financiamento, tabelas de retorno e credenciais bancárias de integração.
                      </p>
                    </div>
                  </div>

                  {/* Card 5: DRE & Finanças */}
                  <div
                    onClick={() => navigate('/admin?tab=dre')}
                    className="p-4 rounded-2xl border border-border/70 hover:border-primary/40 bg-card hover:bg-primary/5 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                        DRE & Demonstração Financeira
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        DRE da operação, margem média por veículo, faturamento consolidado e fluxo de caixa.
                      </p>
                    </div>
                  </div>

                  {/* Card 6: Auditoria & Segurança */}
                  <div
                    onClick={() => navigate('/admin?tab=auditoria')}
                    className="p-4 rounded-2xl border border-border/70 hover:border-primary/40 bg-card hover:bg-primary/5 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                        Trilha de Auditoria & Segurança
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Rastreamento das ações da equipe, histórico de alterações sensíveis e logs de segurança.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
