import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Users } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStores } from '@/hooks/useStores';
import { useCreateReseller } from '@/hooks/useMutations';
import { useAuth } from '@/contexts/AuthContext';
import { maskCPFCNPJ, maskPhone } from '@/lib/masks';

const resellerSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório').max(200),
  cpf: z.string().optional(),
  phone: z.string().min(8, 'Informe o telefone').max(20),
  email: z.string().email('Email inválido').max(255).optional().or(z.literal('')),
  store_id: z.string().min(1, 'Loja é obrigatória'),
  commission_rate: z.coerce.number().min(0).max(100).optional(),
});

type ResellerFormData = z.infer<typeof resellerSchema>;

interface ResellerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResellerFormDialog({ open, onOpenChange }: ResellerFormDialogProps) {
  const { data: stores } = useStores();
  const createReseller = useCreateReseller();
  const { hasElevatedAccess } = useAuth();

  const form = useForm<ResellerFormData>({
    resolver: zodResolver(resellerSchema),
    defaultValues: {
      full_name: '',
      cpf: '',
      phone: '',
      email: '',
      store_id: 'store-divinopolis',
      commission_rate: 5,
    },
  });

  const onSubmit = async (data: ResellerFormData) => {
    await createReseller.mutateAsync({
      full_name: data.full_name,
      cpf: data.cpf || undefined,
      phone: data.phone,
      email: data.email || `${data.full_name.toLowerCase().replace(/\s+/g, '.')}@parceiro.com.br`,
      store_id: data.store_id || 'store-divinopolis',
      commission_rate: data.commission_rate,
    });
    form.reset({
      full_name: '',
      cpf: '',
      phone: '',
      email: '',
      store_id: 'store-divinopolis',
      commission_rate: 5,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Users className="w-5 h-5 text-primary" />
            Novo Revendedor Parceiro
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome / Razão Social *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Oeste Motos Multimarcas" className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF / CNPJ</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="000.000.000-00"
                        className="h-9 font-mono"
                        onChange={(e) => field.onChange(maskCPFCNPJ(e.target.value))}
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone / WhatsApp *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="(37) 99999-0000"
                        className="h-9"
                        onChange={(e) => field.onChange(maskPhone(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail (Opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="contato@revenda.com.br" className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="store_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Concessionária Vinculada *</FormLabel>
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
              {hasElevatedAccess && (
                <FormField
                  control={form.control}
                  name="commission_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comissão Padrão (%)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="5" className="h-9" min={0} max={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createReseller.isPending}>
                {createReseller.isPending ? 'Salvando...' : 'Salvar Revendedor'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
