import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Mail,
  KeyRound,
} from 'lucide-react';
import { AeroBladeMark } from '@/components/brand/PixelLoomLogo';
import { DitherField } from '@/components/auth/DitherField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import bridgeDither from '@/assets/bridge-dither.png';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Informe um e-mail válido' }).max(255),
  password: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres' }).max(100),
});

const REMEMBER_EMAIL_KEY = 'pixel_motors_remember_email';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [authMode, setAuthMode] = useState<'email' | 'key'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const { signIn, signInWithMasterKey, user, isLoading, isDataReady } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Carrega e-mail salvo se "Lembrar meu e-mail" estiver ativo
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (savedEmail && !savedEmail.includes('momentsserie6')) {
        setEmail(savedEmail);
        setRememberMe(true);
      } else if (savedEmail) {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {}
  }, []);

  // Redireciona usuário autenticado
  useEffect(() => {
    if (user && !isLoading && isDataReady) {
      navigate('/', { replace: true });
    }
  }, [user, isLoading, isDataReady, navigate]);

  // Monitora estado do Caps Lock
  const handleKeyActivity = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    if (authMode === 'key') {
      if (!masterKey.trim()) {
        setErrors({ general: 'Informe a Chave Mestra para continuar.' });
        setIsSubmitting(false);
        return;
      }
      const { error } = await signInWithMasterKey(masterKey);
      if (error) {
        setErrors({ general: error.message });
        toast({
          variant: 'destructive',
          title: 'Acesso Negado',
          description: error.message,
        });
        setIsSubmitting(false);
        return;
      }
      toast({
        title: 'Chave Mestra Validada',
        description: 'Autenticação executiva aprovada. Acessando terminal...',
      });
      setIsSubmitting(false);
      navigate('/', { replace: true });
      return;
    }

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    // Salva ou remove e-mail do localStorage conforme a preferência do usuário
    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {}

    const { error } = await signIn(email, password);

    if (error) {
      let message = 'Erro ao realizar login. Verifique suas credenciais.';
      if (error.message.includes('Invalid login credentials')) {
        message = 'E-mail ou senha incorretos.';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Confirme seu e-mail antes de efetuar o login.';
      }
      setErrors({ general: message });
      toast({
        variant: 'destructive',
        title: 'Falha no login',
        description: message,
      });
      setIsSubmitting(false);
    }
  };

  if (user && isDataReady) {
    return null;
  }

  return (
    <main className="relative min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-white select-none">
      {/* ========================================================================= */}
      {/* BACKGROUND FULL-SCREEN: HALFTONE DITHER FIELD COM PONTE & SKYLINE         */}
      {/* ========================================================================= */}
      <DitherField
        src={bridgeDither}
        className="fixed inset-0 z-0 pointer-events-auto"
        cellSize={3.5}
        disturbRadius={150}
        ink="#000000"
        accent="#ED1C24"
      />

      {/* Degradê suave de fusão na base da tela (conforme o layout original) */}
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-white via-white/85 to-transparent z-[1]"
        aria-hidden="true"
      />

      {/* Marca d'água no canto inferior direito exatamente como na referência */}
      <div
        className="pointer-events-none fixed bottom-3.5 right-6 z-[2] text-[10.5px] font-mono tracking-wider text-neutral-400/90 select-none"
        aria-hidden="true"
      >
        Interactive Dither Field
      </div>

      {/* ========================================================================= */}
      {/* CARD FLUTUANTE CENTRAL DE ACESSO (CONFORME A REFERÊNCIA VISUAL)           */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full max-w-[420px] animate-scale-in">
        <section className="rounded-[28px] border border-neutral-200/90 bg-white/95 p-7 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Badge Escuro do Topo com Monograma Oficial Aero Blade */}
          <div className="mx-auto -mt-2 mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0B0F17] p-2.5 shadow-xl ring-1 ring-black/10 border border-white/10">
            <AeroBladeMark size={56} variant="default" />
          </div>

          {/* Título & Subtítulo */}
          <h1 className="text-center font-display text-2xl font-black tracking-tight text-neutral-900">
            PIXEL <span className="text-[#ED1C24]">MOTORS</span>
          </h1>
          <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Central de Gestão de Concessionárias
          </p>

          {/* Seletor de Modo: E-mail / Chave Mestra */}
          <div className="mt-5 mb-5 flex rounded-xl bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('email');
                setErrors({});
              }}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all',
                authMode === 'email'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              )}
            >
              <Mail className="h-3.5 w-3.5" />
              E-mail
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('key');
                setErrors({});
              }}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all',
                authMode === 'key'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              )}
            >
              <KeyRound className="h-3.5 w-3.5 text-[#ED1C24]" />
              Chave Mestra
            </button>
          </div>

          {/* Formulário de Acesso */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            {authMode === 'email' ? (
              <>
                {/* Campo de E-mail */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="ml-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600"
                  >
                    E-mail cadastrado
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-900 placeholder:text-neutral-400 focus-visible:border-[#5B42F3] focus-visible:ring-[#5B42F3]/20 aria-[invalid=true]:border-destructive"
                    disabled={isSubmitting}
                    autoComplete="email"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs font-medium text-destructive">{errors.email}</p>
                  )}
                </div>

                {/* Campo de Senha */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-0.5">
                    <Label
                      htmlFor="password"
                      className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600"
                    >
                      Senha
                    </Label>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
                      onClick={() => setAuthMode('key')}
                    >
                      Acesso contingência
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyActivity}
                      onKeyUp={handleKeyActivity}
                      aria-invalid={Boolean(errors.password)}
                      className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 pr-10 text-xs font-semibold text-neutral-900 placeholder:text-neutral-400 focus-visible:border-[#5B42F3] focus-visible:ring-[#5B42F3]/20 aria-[invalid=true]:border-destructive"
                      disabled={isSubmitting}
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-neutral-400 hover:text-neutral-700"
                      aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Alerta de Caps Lock Ativado */}
                  {capsLockActive && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 pt-0.5 animate-in fade-in">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Atenção: A tecla <strong>Caps Lock</strong> está ativada.
                      </span>
                    </div>
                  )}

                  {errors.password && (
                    <p className="mt-1 text-xs font-medium text-destructive">{errors.password}</p>
                  )}
                </div>

                {/* Opção "Lembrar meu e-mail" */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-xs font-medium text-neutral-500 cursor-pointer select-none hover:text-neutral-800 transition-colors"
                  >
                    Lembrar meu e-mail neste dispositivo
                  </label>
                </div>
              </>
            ) : (
              /* Modo Chave Mestra */
              <div className="space-y-1.5">
                <Label
                  htmlFor="masterKey"
                  className="ml-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600"
                >
                  Chave Mestra de Acesso
                </Label>
                <div className="relative">
                  <Input
                    id="masterKey"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="PX-MASTER-••••-••••"
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    className="h-11 rounded-xl border-neutral-200 bg-white px-3.5 pr-10 text-xs font-semibold text-neutral-900 placeholder:text-neutral-400 focus-visible:border-[#5B42F3] focus-visible:ring-[#5B42F3]/20"
                    disabled={isSubmitting}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-neutral-400 hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                  <span>Chave corporativa de contingência</span>
                  <button
                    type="button"
                    onClick={() => setAuthMode('email')}
                    className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                  >
                    Voltar ao e-mail
                  </button>
                </div>
              </div>
            )}

            {/* Botão de Envio (Púrpura/Índigo vibrante conforme a referência) */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="group h-11 w-full rounded-xl font-bold text-xs bg-[#5B42F3] hover:bg-[#4E34E8] text-white shadow-lg shadow-[#5B42F3]/25 active:scale-[0.99] transition-all"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validando credenciais...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Acessar Painel
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </Button>
          </form>

          {/* Informações de Segurança */}
          <div className="mt-5 border-t border-neutral-100 pt-3.5">
            <p className="flex items-center justify-center gap-1.5 text-center text-[10.5px] font-medium text-neutral-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Ambiente corporativo protegido com sessões individuais
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
