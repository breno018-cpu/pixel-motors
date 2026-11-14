import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { saveUserDefinedPassword } from '@/lib/userService';
import { cn } from '@/lib/utils';

const passwordSchema = z.object({
  newPassword: z.string()
    .min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface ChangePasswordDialogProps {
  open: boolean;
  onSuccess: () => void;
}

export function ChangePasswordDialog({ open, onSuccess }: ChangePasswordDialogProps) {
  const { user, profile } = useAuth();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = form.watch('newPassword');
  const confirmPassword = form.watch('confirmPassword');

  const requirements = useMemo(() => [
    { label: 'Mínimo de 6 caracteres', met: newPassword.length >= 6 },
  ], [newPassword]);

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const allRequirementsMet = requirements.every(r => r.met);

  const onSubmit = async (data: PasswordFormData) => {
    setIsSubmitting(true);
    try {
      const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
      const userId = user?.id || profile?.id || '';

      if (userEmail) saveUserDefinedPassword(userEmail, data.newPassword);
      if (userId) saveUserDefinedPassword(userId, data.newPassword);

      // Se houver sessão Supabase Auth ativa, tenta atualizar
      try {
        await supabase.auth.updateUser({
          password: data.newPassword,
        });
      } catch {}

      // Atualiza profiles se possível
      if (userId) {
        try {
          await supabase
            .from('profiles')
            .update({ must_change_password: false })
            .eq('id', userId);
        } catch {}
      }

      toast({ 
        title: 'Senha cadastrada com sucesso!', 
        description: 'Sua senha pessoal foi definida. Guarde-a para seus próximos logins.' 
      });
      
      form.reset();
      onSuccess();
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao cadastrar senha.';
      toast({ 
        variant: 'destructive', 
        title: 'Erro', 
        description: errorMessage 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md" 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Definição Obrigatória de Nova Senha
          </DialogTitle>
          <DialogDescription className="flex items-start gap-2 bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 p-3 rounded-lg mt-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="text-xs space-y-1">
              <span className="font-bold block text-amber-950 dark:text-amber-100">
                Prazo Limite: Hoje (14/11/2026)
              </span>
              <span>
                Por determinação de segurança, o prazo para criação da sua nova senha pessoal encerra-se hoje. É obrigatório cadastrar sua nova senha para continuar utilizando a plataforma.
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Digite sua nova senha"
                        className="pr-10"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Nova Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirme sua nova senha"
                        className={cn(
                          "pr-10",
                          confirmPassword.length > 0 && (passwordsMatch ? "border-success" : "border-destructive")
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  {confirmPassword.length > 0 && (
                    <p className={cn(
                      "text-xs flex items-center gap-1",
                      passwordsMatch ? "text-success" : "text-destructive"
                    )}>
                      {passwordsMatch ? (
                        <><Check className="w-3 h-3" /> Senhas conferem</>
                      ) : (
                        <><X className="w-3 h-3" /> Senhas não conferem</>
                      )}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password Requirements */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">A senha deve conter:</p>
              <div className="space-y-1">
                {requirements.map((req, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "text-xs flex items-center gap-2 transition-colors",
                      req.met ? "text-success" : "text-muted-foreground"
                    )}
                  >
                    {req.met ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    {req.label}
                  </div>
                ))}
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || !allRequirementsMet || !passwordsMatch} 
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Definir Nova Senha'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
