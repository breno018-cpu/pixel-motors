import { useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { useUpdateStore } from '@/hooks/useStoreMutations';
import { maskPhone, maskCPFCNPJ, unmaskValue } from '@/lib/masks';
import { normalizeHandle } from '@/lib/adLibrary';

const storeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  instagram_handle: z.string().max(60).optional(),
  is_active: z.boolean(),
});

type StoreFormData = z.infer<typeof storeSchema>;

interface StoreData {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  instagram_handle?: string | null;
  is_active: boolean;
}

interface StoreEditDialogProps {
  store: StoreData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoreEditDialog({ store, open, onOpenChange }: StoreEditDialogProps) {
  const updateStore = useUpdateStore();

  const form = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: '',
      cnpj: '',
      address: '',
      city: '',
      state: '',
      phone: '',
      email: '',
      instagram_handle: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (store) {
      form.reset({
        name: store.name,
        cnpj: store.cnpj || '',
        address: store.address || '',
        city: store.city || '',
        state: store.state || '',
        phone: store.phone || '',
        email: store.email || '',
        instagram_handle: store.instagram_handle || '',
        is_active: store.is_active,
      });
    }
  }, [store, form]);

  const onSubmit = (data: StoreFormData) => {
    if (!store) return;
    
    updateStore.mutate(
      { 
        id: store.id, 
        name: data.name,
        cnpj: data.cnpj ? unmaskValue(data.cnpj) : null,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        instagram_handle: data.instagram_handle ? normalizeHandle(data.instagram_handle) || null : null,
        is_active: data.is_active,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  if (!store) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Store className="w-5 h-5 text-primary" />
            Editar Loja
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Loja *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome da loja" className="h-9" />
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
                      placeholder="00.000.000/0000-00"
                      className="h-9"
                      onChange={(e) => field.onChange(maskCPFCNPJ(e.target.value))}
                      maxLength={18}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Rua, número, bairro" className="h-9" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Cidade" className="h-9" />
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
                    <FormLabel>Estado</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="UF" maxLength={2} className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                        className="h-9"
                        onChange={(e) => field.onChange(maskPhone(e.target.value))}
                        maxLength={15}
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
                      <Input {...field} type="email" placeholder="loja@email.com" className="h-9" />
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
                        placeholder="loja.oficial"
                        className="h-9 pl-7"
                        onChange={(e) => field.onChange(normalizeHandle(e.target.value))}
                      />
                    </div>
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground">
                    Usado para mapear os anúncios rodados por esta loja.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">Loja Ativa</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Lojas inativas não aparecem nas opções de seleção
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateStore.isPending}>
                {updateStore.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
