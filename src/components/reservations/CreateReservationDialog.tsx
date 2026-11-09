import { useState, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, Car, Bike, FileText, Search } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useVehicles } from '@/hooks/useVehicles';
import { useStores } from '@/hooks/useStores';
import { useResellers } from '@/hooks/useResellers';
import { useActiveTemplates } from '@/hooks/useContractTemplates';
import { useCreateReservation } from '@/hooks/useReservations';
import { useAuth } from '@/contexts/AuthContext';
import {
  maskCPFCNPJ,
  maskPhone,
  maskCurrency,
  parseCurrency,
  unmaskValue,
  validateCPFCNPJ,
} from '@/lib/masks';

const schema = z.object({
  vehicle_id: z.string().min(1, 'Selecione um veículo'),
  store_id: z.string().min(1, 'Selecione a loja'),
  reseller_id: z.string().optional(),
  buyer_name: z.string().min(3, 'Nome obrigatório').max(200),
  buyer_document: z
    .string()
    .min(14, 'Documento inválido')
    .refine((v) => validateCPFCNPJ(v), 'CPF/CNPJ inválido'),
  buyer_phone: z.string().optional(),
  buyer_email: z.string().optional(),
  vehicle_price: z.string().min(1, 'Valor obrigatório'),
  reservation_amount: z.string().min(1, 'Valor da reserva obrigatório'),
  payment_method: z.string().min(1, 'Forma de pagamento obrigatória'),
  expires_at: z.string().optional(),
  template_id: z.string().min(1, 'Selecione o contrato de reserva (assinatura obrigatória)'),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVehicleId?: string;
}

export function CreateReservationDialog({ open, onOpenChange, initialVehicleId }: Props) {
  const [search, setSearch] = useState('');
  const { data: vehicles } = useVehicles();
  const { data: stores } = useStores();
  const { data: resellers } = useResellers();
  const { data: templates } = useActiveTemplates();
  const createReservation = useCreateReservation();
  const { user } = useAuth();

  const reservationTemplates = (templates || []).filter(
    (t) => t.template_type === 'reserva',
  );

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: '',
      store_id: '',
      reseller_id: '',
      buyer_name: '',
      buyer_document: '',
      buyer_phone: '',
      buyer_email: '',
      vehicle_price: '',
      reservation_amount: '',
      payment_method: '',
      expires_at: '',
      template_id: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      setSearch('');
    } else if (initialVehicleId) {
      form.setValue('vehicle_id', initialVehicleId);
    }
  }, [open, initialVehicleId]);

  useEffect(() => {
    if (open && !form.getValues('template_id') && reservationTemplates.length > 0) {
      form.setValue('template_id', reservationTemplates[0].id);
    }
  }, [open, reservationTemplates.length]);

  const availableVehicles = useMemo(() => {
    const list = (vehicles || []).filter((v) => v.status === 'disponivel');
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (v) =>
        v.brand.toLowerCase().includes(s) ||
        v.model.toLowerCase().includes(s) ||
        v.chassis?.toLowerCase().includes(s) ||
        v.plate?.toLowerCase().includes(s),
    );
  }, [vehicles, search]);

  const selectedVehicle = vehicles?.find(
    (v) => v.id === form.watch('vehicle_id'),
  );

  useEffect(() => {
    if (selectedVehicle) {
      if (selectedVehicle.sale_price) {
        form.setValue('vehicle_price', maskCurrency(selectedVehicle.sale_price));
      }
      if (selectedVehicle.store_id) {
        form.setValue('store_id', selectedVehicle.store_id);
      }
    }
  }, [selectedVehicle?.id]);

  const onSubmit = async (data: FormData) => {
    await createReservation.mutateAsync({
      vehicle_id: data.vehicle_id,
      store_id: data.store_id,
      reseller_id: data.reseller_id || null,
      buyer_name: data.buyer_name,
      buyer_cpf: unmaskValue(data.buyer_document),
      buyer_phone: data.buyer_phone || null,
      buyer_email: data.buyer_email || null,
      buyer_address: null,
      vehicle_price: parseCurrency(data.vehicle_price),
      reservation_amount: parseCurrency(data.reservation_amount),
      payment_method: data.payment_method,
      expires_at: data.expires_at || null,
      template_id: data.template_id,
      notes: data.notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <CalendarClock className="w-5 h-5 text-primary" />
            Nova Reserva de Veículo
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Veículo */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Veículo</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por chassi, placa, marca..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
              <FormField
                control={form.control}
                name="vehicle_id"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecionar veículo disponível" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {availableVehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            <div className="flex items-center gap-2">
                              {v.vehicle_type === 'moto' ? (
                                <Bike className="w-4 h-4 text-primary" />
                              ) : (
                                <Car className="w-4 h-4 text-primary" />
                              )}
                              <span className="font-medium">
                                {v.brand} {v.model} {v.year}
                              </span>
                              {v.chassis && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  • {v.chassis}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedVehicle && (
                <Card className="bg-muted/40 border-border">
                  <CardContent className="p-3 flex items-center gap-3">
                    {selectedVehicle.vehicle_type === 'moto' ? (
                      <Bike className="w-5 h-5 text-primary" />
                    ) : (
                      <Car className="w-5 h-5 text-primary" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {selectedVehicle.brand} {selectedVehicle.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedVehicle.year} • {selectedVehicle.color} •{' '}
                        {selectedVehicle.chassis}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      Disponível
                    </Badge>
                  </CardContent>
                </Card>
              )}

              <FormField
                control={form.control}
                name="store_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loja *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecionar loja" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stores
                          ?.filter((s) => s.is_active)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reseller_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revendedor (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Sem revendedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {resellers
                          ?.filter((r) => r.is_active)
                          .map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.full_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cliente */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Cliente</h3>
              <FormField
                control={form.control}
                name="buyer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="buyer_document"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="h-10"
                          onChange={(e) => field.onChange(maskCPFCNPJ(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="buyer_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="h-10"
                          onChange={(e) => field.onChange(maskPhone(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="buyer_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Reserva financeira */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Reserva</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="vehicle_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Veículo *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="R$ 0,00"
                          className="h-10"
                          onChange={(e) => field.onChange(maskCurrency(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reservation_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor pago para reservar *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="R$ 0,00"
                          className="h-10"
                          onChange={(e) => field.onChange(maskCurrency(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                          <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expires_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Válida até</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {reservationTemplates.length > 0 && (
                <FormField
                  control={form.control}
                  name="template_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Contrato de reserva *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Sem contrato" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {reservationTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                O valor pago para reservar <b>não é devolvido</b> em caso de desistência ou cancelamento pelo comprador. A reserva só vale com o contrato assinado (no papel ou pelo gov.br).
              </p>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} className="resize-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createReservation.isPending}>
                {createReservation.isPending ? 'Criando...' : 'Criar Reserva'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}