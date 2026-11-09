import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useUpdateReseller } from '@/hooks/useResellerMutations';
import { useAuth } from '@/contexts/AuthContext';
import { maskCPF, maskPhone } from '@/lib/masks';

const resellerSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cpf: z.string().min(11, 'CPF inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  store_id: z.string().optional(),
  commission_rate: z.coerce.number().min(0).max(100).optional(),
});

type ResellerFormData = z.infer<typeof resellerSchema>;

interface ResellerData {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  store_id: string | null;
  commission_rate: number | null;
  is_active: boolean;
}

interface ResellerEditDialogProps {
  reseller: ResellerData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResellerEditDialog({ reseller, open, onOpenChange }: ResellerEditDialogProps) {
  const { data: stores } = useStores();
  const updateReseller = useUpdateReseller();
  const { hasElevatedAccess } = useAuth();

  const form = useForm<ResellerFormData>({
    resolver: zodResolver(resellerSchema),
    defaultValues: {
      full_name: '',
      cpf: '',
      phone: '',
      email: '',
      store_id: '',
      commission_rate: 0,
    },
  });

  useEffect(() => {
    if (reseller && open) {
      form.reset({
        full_name: reseller.full_name || '',
        cpf: reseller.cpf || '',
        phone: reseller.phone || '',
        email: reseller.email || '',
        store_id: reseller.store_id || '',
        commission_rate: reseller.commission_rate || 0,
      });
    }
  }, [reseller, open, form]);

  const onSubmit = (data: ResellerFormData) => {
    if (!reseller) return;
    
    updateReseller.mutate(
      { 
        id: reseller.id, 
        ...data,
        cpf: data.cpf?.replace(/\D/g, '') || null,
        phone: data.phone?.replace(/\D/g, '') || null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  if (!reseller) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Revendedor</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome do revendedor" />
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
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="000.000.000-00"
                      onChange={(e) => field.onChange(maskCPF(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="(00) 00000-0000"
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="email@exemplo.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="store_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loja</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma loja" />
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
                    <FormLabel>Comissão (%)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.1" min="0" max="100" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateReseller.isPending}>
                {updateReseller.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
