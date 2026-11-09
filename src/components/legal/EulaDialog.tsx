import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { ScrollText, ShieldCheck, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { EULA_CLAUSES, EULA_VERSION } from '@/lib/eulaContent';

interface EulaDialogProps {
  open: boolean;
  onAccepted: () => void;
}

export function EulaDialog({ open, onAccepted }: EulaDialogProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState<string[]>([]);

  const progress = useMemo(
    () => Math.round((opened.length / EULA_CLAUSES.length) * 100),
    [opened.length]
  );

  const handleAccept = async () => {
    if (!user) return;
    setSaving(true);

    // 1. Grava imediatamente no localStorage e sessionStorage para NUNCA mais reabrir neste navegador
    const userKey = `eula_accepted_${EULA_VERSION}_${user.id}`;
    const globalKey = `eula_accepted_v${EULA_VERSION}`;
    try {
      localStorage.setItem(userKey, 'true');
      localStorage.setItem(globalKey, 'true');
      localStorage.setItem(`eula_accepted_at_${EULA_VERSION}`, new Date().toISOString());
      sessionStorage.setItem(userKey, 'true');
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }

    // 2. Se for um UUID válido do Supabase, tenta persistir na nuvem em segundo plano
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (isUuid) {
      try {
        await supabase.from('eula_acceptances').insert({
          user_id: user.id,
          version: EULA_VERSION,
          user_agent: navigator.userAgent,
          full_name_typed: profile?.full_name ?? null,
        });
      } catch (err) {
        console.warn('Erro ao salvar aceite no Supabase (mantido no localStorage):', err);
      }
    }

    setSaving(false);
    toast({
      title: 'Termos de Uso Aceitos com Sucesso!',
      description: 'Seu aceite foi registrado em definitivo. Esta mensagem não aparecerá novamente.',
    });
    onAccepted();
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-2xl [&>button]:hidden gap-4"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ScrollText className="h-5 w-5" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-base">Termos de Uso — PixelLoom</DialogTitle>
              <DialogDescription className="text-xs">
                Versão {EULA_VERSION} · {EULA_CLAUSES.length} cláusulas · aceite único
              </DialogDescription>
            </div>
          </div>
          <div className="space-y-1.5">
            <Progress value={progress} className="h-1" />
            <p className="text-[11px] text-muted-foreground text-left">
              {opened.length} de {EULA_CLAUSES.length} cláusulas abertas — toque em cada título para ler o conteúdo completo.
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[46vh] rounded-lg border bg-muted/20 px-3">
          <Accordion
            type="multiple"
            value={opened}
            onValueChange={(v) => setOpened(v as string[])}
            className="w-full"
          >
            {EULA_CLAUSES.map((clause) => (
              <AccordionItem key={clause.id} value={clause.id} className="border-border/60">
                <AccordionTrigger className="py-3 text-left text-[13px] font-medium hover:no-underline">
                  <span className="flex items-center gap-2">
                    {opened.includes(clause.id) ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                    )}
                    {clause.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-4 text-xs leading-relaxed text-muted-foreground text-justify">
                  {clause.body.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label
            htmlFor="eula-accept"
            className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40"
          >
            <Checkbox
              id="eula-accept"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            Li e concordo integralmente com todos os termos.
          </label>
          <Button
            onClick={handleAccept}
            disabled={!checked || saving}
            className="gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShieldCheck className="h-4 w-4" />
            {saving ? 'Registrando...' : 'Aceitar e continuar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
