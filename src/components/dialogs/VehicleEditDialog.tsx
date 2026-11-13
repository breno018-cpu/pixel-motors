import { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Car } from 'lucide-react';
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
import { useStores } from '@/hooks/useStores';
import { useUpdateVehicle } from '@/hooks/useVehicleMutations';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { ModelCatalogSelect } from '@/components/vehicles/ModelCatalogSelect';
import { STANDARD_COLORS, isElectricVehicle } from '@/lib/vehicleCatalog';

const vehicleSchema = z.object({
  chassis: z.string().max(50).optional().or(z.literal('')),
  plate: z.string().max(10).optional().or(z.literal('')),
  renavam: z.string().max(20).optional().or(z.literal('')),
  brand: z.string().min(1, 'Marca é obrigatória').max(50),
  model: z.string().min(1, 'Modelo é obrigatório').max(100),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  manufacture_year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  color: z.string().min(1, 'Cor é obrigatória').max(30),
  mileage: z.coerce.number().min(0, 'Quilometragem não pode ser negativa'),
  fuel_type: z.string().optional(),
  transmission: z.string().optional(),
  store_id: z.string().min(1, 'Loja é obrigatória'),
  sale_price: z.coerce.number().min(0, 'Preço não pode ser negativo'),
  purchase_price: z.coerce.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  warranty_months: z.coerce.number().min(0).max(120).optional(),
  revision_period_months: z.coerce.number().min(0).max(120).optional(),
  revision_period_km: z.coerce.number().min(0).max(500000).optional(),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  manufacture_year?: number | null;
  color: string | null;
  plate: string | null;
  chassis: string | null;
  renavam: string | null;
  mileage: number | null;
  fuel_type: string | null;
  transmission: string | null;
  status: string;
  sale_price: number | null;
  purchase_price: number | null;
  notes: string | null;
  store_id: string | null;
  warranty_months?: number | null;
  revision_period_months?: number | null;
  revision_period_km?: number | null;
  vehicle_type?: string | null;
}

interface VehicleEditDialogProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleEditDialog({ vehicle, open, onOpenChange }: VehicleEditDialogProps) {
  const { data: stores } = useStores();
  const updateVehicle = useUpdateVehicle();
  const { isAdmin, isManager } = useAuth();
  const confirm = useConfirm();

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      chassis: '',
      plate: '',
      renavam: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      manufacture_year: undefined,
      color: '',
      mileage: 0,
      fuel_type: '',
      transmission: '',
      store_id: '',
      sale_price: 0,
      purchase_price: undefined,
      notes: '',
      warranty_months: undefined,
      revision_period_months: undefined,
      revision_period_km: undefined,
    },
  });

  useEffect(() => {
    if (vehicle) {
      form.reset({
        chassis: vehicle.chassis || '',
        plate: vehicle.plate || '',
        renavam: vehicle.renavam || '',
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        manufacture_year: vehicle.manufacture_year ?? undefined,
        color: vehicle.color || '',
        mileage: vehicle.mileage || 0,
        fuel_type: vehicle.fuel_type || '',
        transmission: vehicle.transmission || '',
        store_id: vehicle.store_id || '',
        sale_price: vehicle.sale_price || 0,
        purchase_price: vehicle.purchase_price || undefined,
        notes: vehicle.notes || '',
        warranty_months: vehicle.warranty_months ?? undefined,
        revision_period_months: vehicle.revision_period_months ?? undefined,
        revision_period_km: vehicle.revision_period_km ?? undefined,
      });
    }
  }, [vehicle, form]);

  const onSubmit = async (data: VehicleFormData) => {
    if (!vehicle) return;

    const payload: Record<string, unknown> = {
        brand: data.brand,
        model: data.model,
        year: data.year,
        manufacture_year: data.manufacture_year ?? null,
        color: data.color,
        plate: data.plate || null,
        renavam: data.renavam || null,
        mileage: data.mileage,
        fuel_type: data.fuel_type || null,
        transmission: data.transmission || null,
        store_id: data.store_id,
        sale_price: data.sale_price,
        purchase_price: data.purchase_price,
        notes: data.notes || null,
        warranty_months: data.warranty_months ?? null,
        revision_period_months: data.revision_period_months ?? null,
        revision_period_km: data.revision_period_km ?? null,
    };

    // Apenas admin pode alterar o chassi
    if (isAdmin && data.chassis && data.chassis !== vehicle.chassis) {
      payload.chassis = data.chassis.toUpperCase();
    }

    const confirmed = await confirm({
      title: 'Salvar Alterações do Veículo?',
      description: `Deseja atualizar as informações do veículo ${data.brand} ${data.model}?`,
      confirmText: 'Salvar Alterações',
      cancelText: 'Cancelar',
      variant: 'default',
    });

    if (!confirmed) return;

    await updateVehicle.mutateAsync({ id: vehicle.id, data: payload });
    onOpenChange(false);
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Car className="w-5 h-5 text-primary" />
            Editar Veículo
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Identification */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Identificação</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="chassis"
                  render={({ field }) => {
                    const isElectric = isElectricVehicle({
                      fuel_type: form.watch('fuel_type') || vehicle?.fuel_type,
                      model: form.watch('model') || vehicle?.model,
                      brand: form.watch('brand') || vehicle?.brand,
                      notes: form.watch('notes') || vehicle?.notes,
                    });
                    return (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>
                          {isElectric ? 'Número da Moto / Motor' : 'Chassi (VIN) / Identificação'}
                          <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                            {isElectric
                              ? '(Motos elétricas: cadastre o número da moto/motor gravado no veículo)'
                              : '(17 caracteres para motos a combustão)'}
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={isElectric ? 'Número da moto / motor...' : '17 caracteres (ex: 99HSHF...)'}
                            className="h-9 uppercase font-mono"
                            maxLength={50}
                            disabled={!isAdmin && Boolean(field.value && field.value.length === 17 && !isElectric)}
                            readOnly={!isAdmin && Boolean(field.value && field.value.length === 17 && !isElectric)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ABC-1234" className="h-9 uppercase" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="renavam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Renavam</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Opcional" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Descrição</h3>
              <ModelCatalogSelect
                vehicleType={vehicle?.vehicle_type === 'carro' ? 'carro' : 'moto'}
                brand={form.watch('brand')}
                model={form.watch('model')}
                onChange={({ brand, model }) => {
                  const opts = { shouldValidate: true, shouldDirty: true } as const;
                  form.setValue('brand', brand, opts);
                  form.setValue('model', model, opts);
                }}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano modelo *</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" className="h-9" />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground">Aparece no contrato</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="manufacture_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano de fabricação</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} type="number" className="h-9" />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground">Apenas controle interno</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecionar cor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-50">
                          {STANDARD_COLORS.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                          {field.value && !STANDARD_COLORS.includes(field.value as typeof STANDARD_COLORS[number]) && (
                            <SelectItem value={field.value}>{field.value} (atual)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="mileage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quilometragem *</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="0" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fuel_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Combustível</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gasolina">Gasolina</SelectItem>
                          <SelectItem value="etanol">Etanol</SelectItem>
                          <SelectItem value="flex">Flex</SelectItem>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="eletrico">Elétrico</SelectItem>
                          <SelectItem value="hibrido">Híbrido</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="transmission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Câmbio</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="automatico">Automático</SelectItem>
                          <SelectItem value="cvt">CVT</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Localização</h3>
              <FormField
                control={form.control}
                name="store_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loja *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecionar loja" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stores?.filter(s => s.is_active).map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Preço</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço de Venda *</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="R$ 0,00" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isAdmin || isManager ? (
                  <FormField
                    control={form.control}
                    name="purchase_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço de Custo</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="R$ 0,00" className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Notas internas..." className="resize-none" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Warranty & Revision */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Garantia e Revisões</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="warranty_months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Garantia (meses)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} type="number" placeholder="Ex: 3" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="revision_period_months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Revisão (meses)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} type="number" placeholder="Ex: 6" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="revision_period_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Revisão (km)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} type="number" placeholder="Ex: 10000" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateVehicle.isPending}>
                {updateVehicle.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
