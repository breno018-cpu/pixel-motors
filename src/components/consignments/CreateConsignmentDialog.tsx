import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useResellers } from '@/hooks/useResellers';
import { maskCurrency, parseCurrency } from '@/lib/masks';

const consignmentSchema = z.object({
  vehicle_cost: z.string().min(1, 'Valor obrigatório'),
  payment_type: z.enum(['percentage', 'full']),
  upfront_percentage: z.coerce.number().min(0).max(100).optional(),
  remaining_percentage: z.coerce.number().min(0).max(100).optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
});

type ConsignmentFormData = z.infer<typeof consignmentSchema>;

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  chassis: string;
  store_id: string;
  sale_price: number;
}

interface Reseller {
  id: string;
  full_name: string;
  store_id: string;
}

interface CreateConsignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: Vehicle | null;
  reseller?: Reseller | null;
  onSuccess?: () => void;
}

export function CreateConsignmentDialog({
  open,
  onOpenChange,
  vehicle: propVehicle,
  reseller: propReseller,
  onSuccess,
}: CreateConsignmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: allVehicles = [] } = useVehicles();
  const { data: allResellers = [] } = useResellers();

  const availableVehicles = allVehicles.filter((v) => v.status !== 'vendido');
  const activeResellers = allResellers.filter((r) => r.is_active);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(propVehicle?.id || '');
  const [selectedResellerId, setSelectedResellerId] = useState<string>(propReseller?.id || '');

  const vehicle = propVehicle || availableVehicles.find((v) => v.id === selectedVehicleId) || availableVehicles[0] || null;
  const reseller = propReseller || activeResellers.find((r) => r.id === selectedResellerId) || activeResellers[0] || null;

  const form = useForm<ConsignmentFormData>({
    resolver: zodResolver(consignmentSchema),
    defaultValues: {
      vehicle_cost: vehicle?.sale_price ? maskCurrency(Math.round(vehicle.sale_price * 0.85 * 100)) : 'R$ 13.500,00',
      payment_type: 'percentage',
      upfront_percentage: 30,
      remaining_percentage: 70,
      terms: vehicle && reseller
        ? `Contrato de consignação do veículo ${vehicle.brand} ${vehicle.model} ${vehicle.year} (Chassi: ${vehicle.chassis}) para o revendedor ${reseller.full_name}.\n\nO revendedor se compromete a realizar o pagamento conforme os termos acordados.`
        : 'Contrato comercial de consignação de veículo. O revendedor se compromete a realizar o repasse conforme acordado.',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    const v = propVehicle || availableVehicles.find((x) => x.id === selectedVehicleId) || availableVehicles[0];
    const r = propReseller || activeResellers.find((x) => x.id === selectedResellerId) || activeResellers[0];
    if (v && !selectedVehicleId) setSelectedVehicleId(v.id);
    if (r && !selectedResellerId) setSelectedResellerId(r.id);
    if (v) {
      form.setValue('vehicle_cost', maskCurrency(String(Math.round((v.sale_price || 15000) * 0.85 * 100))));
      if (r) {
        form.setValue(
          'terms',
          `Contrato de consignação do veículo ${v.brand} ${v.model} ${v.year} (Chassi: ${v.chassis}) para o revendedor ${r.full_name}.\n\nO revendedor se compromete a realizar o pagamento conforme os termos acordados.`,
        );
      }
    }
  }, [open, propVehicle, propReseller, selectedVehicleId, selectedResellerId, availableVehicles.length, activeResellers.length]);

  const paymentType = form.watch('payment_type');
  const vehicleCost = parseCurrency(form.watch('vehicle_cost') || '0');
  const upfrontPct = Number(form.watch('upfront_percentage')) || 0;
  const remainingPct = Number(form.watch('remaining_percentage')) || 0;

  const upfrontAmount = vehicleCost * (upfrontPct / 100);
  const remainingAmount = vehicleCost * (remainingPct / 100);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const onSubmit = async (data: ConsignmentFormData) => {
    if (!vehicle || !reseller) {
      toast({ variant: 'destructive', title: 'Selecione o veículo e o revendedor.' });
      return;
    }

    if (data.payment_type === 'percentage') {
      const total = Number(data.upfront_percentage || 0) + Number(data.remaining_percentage || 0);
      if (total !== 100) {
        toast({ variant: 'destructive', title: 'Erro', description: 'As porcentagens devem somar 100%.' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const cost = parseCurrency(data.vehicle_cost);
      const upPct = data.payment_type === 'percentage' ? Number(data.upfront_percentage || 0) : 100;
      const remPct = data.payment_type === 'percentage' ? Number(data.remaining_percentage || 0) : 0;

      const contractData = {
        vehicle_id: vehicle.id,
        reseller_id: reseller.id,
        store_id: vehicle.store_id || reseller.store_id || 'store-divinopolis',
        vehicle_cost: cost,
        payment_type: data.payment_type,
        upfront_percentage: upPct,
        upfront_amount: data.payment_type === 'percentage' ? cost * (upPct / 100) : cost,
        remaining_percentage: remPct,
        remaining_amount: data.payment_type === 'percentage' ? cost * (remPct / 100) : 0,
        full_payment_amount: data.payment_type === 'full' ? cost : 0,
        upfront_paid: false,
        remaining_paid: false,
        status: 'ativo',
        terms: data.terms,
        notes: data.notes,
        created_by: user?.id,
      };

      const { error } = await supabase
        .from('reseller_consignment_contracts')
        .insert(contractData);

      if (error) throw error;

      await supabase
        .from('vehicles')
        .update({ reseller_id: reseller.id })
        .eq('id', vehicle.id);

      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['consignment-contracts'] });

      toast({ title: 'Contrato de consignação criado!', description: `${vehicle.brand} ${vehicle.model} vinculado a ${reseller.full_name}.` });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating consignment:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao criar contrato de consignação.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Novo Contrato de Consignação
          </DialogTitle>
        </DialogHeader>

        {propVehicle && propReseller ? (
          <div className="bg-muted/50 rounded-lg p-4 mb-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Veículo</p>
                <p className="font-medium">{propVehicle.brand} {propVehicle.model} {propVehicle.year}</p>
                <p className="text-xs text-muted-foreground font-mono">{propVehicle.chassis}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Revendedor</p>
                <p className="font-medium">{propReseller.full_name}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3.5 rounded-xl border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Veículo em Estoque *</Label>
              <Select value={vehicle?.id || ''} onValueChange={(val) => setSelectedVehicleId(val)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {availableVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {v.brand} {v.model} ({v.chassis.slice(-6)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Revendedor Parceiro *</Label>
              <Select value={reseller?.id || ''} onValueChange={(val) => setSelectedResellerId(val)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Selecione o revendedor" />
                </SelectTrigger>
                <SelectContent>
                  {activeResellers.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs">
                      {r.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="vehicle_cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor de Repasse para o Revendedor *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="R$ 0,00"
                      onChange={(e) => field.onChange(maskCurrency(e.target.value))}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Valor de tabela ao público: {formatCurrency(vehicle?.sale_price || 0)}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condição de Acerto *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentagem (Sinal + Restante após venda)</SelectItem>
                      <SelectItem value="full">100% no Faturamento</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {paymentType === 'percentage' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="upfront_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>% Entrada (Sinal)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          max={100}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            field.onChange(val);
                            form.setValue('remaining_percentage', 100 - val);
                          }}
                        />
                      </FormControl>
                      <p className="text-xs text-primary font-semibold">
                        = {formatCurrency(upfrontAmount)}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remaining_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>% Após Venda</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          max={100}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            field.onChange(val);
                            form.setValue('upfront_percentage', 100 - val);
                          }}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground font-medium">
                        = {formatCurrency(remainingAmount)}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {paymentType === 'full' && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3.5">
                <p className="text-sm">
                  Acerto integral: <span className="font-bold text-primary">{formatCurrency(vehicleCost)}</span>
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Termos do Contrato</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Termos e condições..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="Observações adicionais..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Criar Consignação'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
