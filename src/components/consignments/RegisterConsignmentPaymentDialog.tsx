import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ConsignmentContract {
  id: string;
  vehicle_cost: number;
  payment_type: 'percentage' | 'full';
  upfront_percentage: number;
  upfront_amount: number;
  remaining_percentage: number;
  remaining_amount: number;
  full_payment_amount: number;
  upfront_paid: boolean;
  remaining_paid: boolean;
  status: string;
}

interface RegisterConsignmentPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ConsignmentContract;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function RegisterConsignmentPaymentDialog({
  open,
  onOpenChange,
  contract,
}: RegisterConsignmentPaymentDialogProps) {
  const [upfrontPaid, setUpfrontPaid] = useState(contract.upfront_paid);
  const [remainingPaid, setRemainingPaid] = useState(contract.remaining_paid);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const updates: Record<string, unknown> = {};
      
      if (upfrontPaid !== contract.upfront_paid) {
        updates.upfront_paid = upfrontPaid;
        if (upfrontPaid) {
          updates.upfront_paid_at = new Date().toISOString();
        }
      }
      
      if (remainingPaid !== contract.remaining_paid) {
        updates.remaining_paid = remainingPaid;
        if (remainingPaid) {
          updates.remaining_paid_at = new Date().toISOString();
        }
      }

      // Verificar se está quitado
      const isFullyPaid = contract.payment_type === 'full' 
        ? upfrontPaid 
        : upfrontPaid && remainingPaid;
      
      if (isFullyPaid) {
        updates.status = 'quitado';
      }

      const { error } = await supabase
        .from('reseller_consignment_contracts')
        .update(updates)
        .eq('id', contract.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['consignment-contracts'] });
      toast({ title: 'Pagamento registrado!', description: isFullyPaid ? 'Contrato quitado.' : 'Pagamento atualizado.' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao registrar pagamento.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Registrar Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">Valor total do contrato</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(contract.vehicle_cost)}</p>
          </div>

          <div className="space-y-4">
            {contract.payment_type === 'percentage' ? (
              <>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="upfront"
                      checked={upfrontPaid}
                      onCheckedChange={(checked) => setUpfrontPaid(checked === true)}
                      disabled={contract.upfront_paid}
                    />
                    <Label htmlFor="upfront" className="cursor-pointer">
                      <span className="block text-sm font-medium">Entrada ({contract.upfront_percentage}%)</span>
                      <span className="block text-xs text-muted-foreground">{formatCurrency(contract.upfront_amount)}</span>
                    </Label>
                  </div>
                  {contract.upfront_paid && (
                    <Check className="w-5 h-5 text-success" />
                  )}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="remaining"
                      checked={remainingPaid}
                      onCheckedChange={(checked) => setRemainingPaid(checked === true)}
                      disabled={contract.remaining_paid}
                    />
                    <Label htmlFor="remaining" className="cursor-pointer">
                      <span className="block text-sm font-medium">Após venda ({contract.remaining_percentage}%)</span>
                      <span className="block text-xs text-muted-foreground">{formatCurrency(contract.remaining_amount)}</span>
                    </Label>
                  </div>
                  {contract.remaining_paid && (
                    <Check className="w-5 h-5 text-success" />
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="full"
                    checked={upfrontPaid}
                    onCheckedChange={(checked) => setUpfrontPaid(checked === true)}
                    disabled={contract.upfront_paid}
                  />
                  <Label htmlFor="full" className="cursor-pointer">
                    <span className="block text-sm font-medium">Pagamento integral</span>
                    <span className="block text-xs text-muted-foreground">{formatCurrency(contract.full_payment_amount)}</span>
                  </Label>
                </div>
                {contract.upfront_paid && (
                  <Check className="w-5 h-5 text-success" />
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
