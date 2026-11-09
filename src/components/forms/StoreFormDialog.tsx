import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Store } from 'lucide-react';
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
import { useCreateStore } from '@/hooks/useMutations';
import { maskCPFCNPJ, maskPhone, unmaskValue } from '@/lib/masks';
import { normalizeHandle } from '@/lib/adLibrary';

const storeSchema = z.object({
  name: z.string().min(1, 'Nome / Razão social é obrigatório').max(200),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  city: z.string().min(1, 'Cidade é obrigatória').max(100),
  state: z.string().min(2, 'UF é obrigatória').max(2),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').max(255).optional().or(z.literal('')),
  instagram_handle: z.string().max(60).optional(),
});

type StoreFormData = z.infer<typeof storeSchema>;

interface StoreFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoreFormDialog({ open, onOpenChange }: StoreFormDialogProps) {
  const createStore = useCreateStore();

  const form = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: '',
      cnpj: '',
      address: '',
      city: '',
      state: 'MG',
      phone: '',
      email: '',
      instagram_handle: '',
    },
  });

  const onSubmit = async (data: StoreFormData) => {
    await createStore.mutateAsync({
      name: data.name,
      cnpj: data.cnpj ? unmaskValue(data.cnpj) : undefined,
      address: data.address || 'Centro',
      city: data.city,
      state: (data.state || 'MG').toUpperCase(),
      phone: data.phone || '(37) 99999-0000',
      email: data.email || 'contato@concessionaria.com.br',
      instagram_handle: data.instagram_handle ? normalizeHandle(data.instagram_handle) || null : null,
    });
    form.reset({
      name: '',
      cnpj: '',
      address: '',
      city: '',
      state: 'MG',
      phone: '',
      email: '',
      instagram_handle: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Store className="w-5 h-5 text-primary" />
            Nova Concessionária / Filial
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Loja / Razão Social *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Concessionária Nova Serrana" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="00.000.000/0001-00"
                          className="h-9 font-mono"
                          onChange={(e) => field.onChange(maskCPFCNPJ(e.target.value))}
                          maxLength={18}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Divinópolis" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="MG" className="h-9 uppercase" maxLength={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Av. Paraná, 1200 - Centro" className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
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
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="contato@loja.com.br" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="instagram_handle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>@ do Instagram</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                        <Input
                          {...field}
                          value={field.value || ''}
                          placeholder="shineray.divinopolis"
                          className="h-9 pl-7"
                          onChange={(e) => field.onChange(normalizeHandle(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createStore.isPending}>
                {createStore.isPending ? 'Salvando...' : 'Salvar Loja'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
