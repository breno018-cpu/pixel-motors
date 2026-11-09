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
import { cn } from '@/lib/utils';

const passwordSchema = z.object({
  newPassword: z.string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um número'),
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
    { label: 'Mínimo de 8 caracteres', met: newPassword.length >= 8 },
    { label: 'Pelo menos uma letra maiúscula', met: /[A-Z]/.test(newPassword) },
    { label: 'Pelo menos uma letra minúscula', met: /[a-z]/.test(newPassword) },
    { label: 'Pelo menos um número', met: /[0-9]/.test(newPassword) },
  ], [newPassword]);

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const allRequirementsMet = requirements.every(r => r.met);

  const onSubmit = async (data: PasswordFormData) => {
    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateError) throw updateError;

      // Update must_change_password flag
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', userData.user.id);
      }

      toast({ 
        title: 'Senha alterada!', 
        description: 'Sua nova senha foi definida com sucesso.' 
      });
      
      form.reset();
      onSuccess();
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao alterar senha.';
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
            Alterar Senha
          </DialogTitle>
          <DialogDescription className="flex items-start gap-2 bg-warning/10 text-warning p-3 rounded-lg mt-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              Você está usando uma senha temporária. Por segurança, é obrigatório definir uma nova senha para continuar.
            </span>
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
