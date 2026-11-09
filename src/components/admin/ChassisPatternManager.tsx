import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, Bike, Car } from 'lucide-react';
import { maskCurrency, parseCurrency } from '@/lib/masks';

interface PatternForm {
  wmi_code: string;
  brand: string;
  vehicle_type: string;
  model_pattern: string;
  model_name: string;
  engine_cc: string;
  fuel_type: string;
  transmission: string;
  warranty_months: string;
  service_interval_months: string;
  service_interval_km: string;
  default_purchase_price: string;
  default_sale_price: string;
}

const emptyForm: PatternForm = {
  wmi_code: '', brand: '', vehicle_type: 'moto',
  model_pattern: '', model_name: '', engine_cc: '', fuel_type: 'Flex',
  transmission: '', warranty_months: '', service_interval_months: '', service_interval_km: '',
  default_purchase_price: '', default_sale_price: '',
};

const toMasked = (value: number | null | undefined) =>
  value != null ? maskCurrency(String(Math.round(value * 100))) : '';

export function ChassisPatternManager({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PatternForm>(emptyForm);
  const [search, setSearch] = useState('');

  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ['chassis-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chassis_patterns')
        .select('*')
        .order('brand', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: PatternForm) => {
      const payload = {
        wmi_code: values.wmi_code.toUpperCase(),
        brand: values.brand,
        vehicle_type: values.vehicle_type,
        model_pattern: values.model_pattern || null,
        model_name: values.model_name || null,
        engine_cc: values.engine_cc ? parseInt(values.engine_cc) : null,
        fuel_type: values.fuel_type || null,
        transmission: values.transmission || null,
        warranty_months: values.warranty_months ? parseInt(values.warranty_months) : null,
        service_interval_months: values.service_interval_months ? parseInt(values.service_interval_months) : null,
        service_interval_km: values.service_interval_km ? parseInt(values.service_interval_km) : null,
        default_purchase_price: values.default_purchase_price ? parseCurrency(values.default_purchase_price) : null,
        default_sale_price: values.default_sale_price ? parseCurrency(values.default_sale_price) : null,
      } as any;
      if (editId) {
        const { error } = await supabase.from('chassis_patterns').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('chassis_patterns').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chassis-patterns'] });
      toast({ title: editId ? 'Padrão atualizado' : 'Padrão cadastrado' });
      closeDialog();
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chassis_patterns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chassis-patterns'] });
      toast({ title: 'Padrão excluído' });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      wmi_code: p.wmi_code,
      brand: p.brand,
      vehicle_type: p.vehicle_type,
      model_pattern: p.model_pattern || '',
      model_name: p.model_name || '',
      engine_cc: p.engine_cc?.toString() || '',
      fuel_type: p.fuel_type || 'Flex',
      transmission: p.transmission || '',
      warranty_months: p.warranty_months?.toString() || '',
      service_interval_months: p.service_interval_months?.toString() || '',
      service_interval_km: p.service_interval_km?.toString() || '',
      default_purchase_price: toMasked(p.default_purchase_price),
      default_sale_price: toMasked(p.default_sale_price),
    });
    setDialogOpen(true);
  };

  const filtered = patterns.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.brand?.toLowerCase().includes(s) ||
      p.model_name?.toLowerCase().includes(s) ||
      p.wmi_code?.toLowerCase().includes(s);
  });

  const body = (
    <>
      {embedded && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5" onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5" />
            Novo
          </Button>
        </div>
      )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca, modelo ou WMI..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="rounded-md border max-h-[350px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">WMI</TableHead>
                <TableHead className="text-xs">Marca</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Padrão</TableHead>
                <TableHead className="text-xs">Modelo</TableHead>
                <TableHead className="text-xs">CC</TableHead>
                <TableHead className="text-xs">Compra</TableHead>
                <TableHead className="text-xs">Venda</TableHead>
                <TableHead className="text-xs w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Nenhum padrão encontrado</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs font-mono">{p.wmi_code}</TableCell>
                  <TableCell className="text-xs font-medium">{p.brand}</TableCell>
                  <TableCell className="text-xs">
                    {p.vehicle_type === 'moto' ? <Bike className="w-3.5 h-3.5 inline" /> : <Car className="w-3.5 h-3.5 inline" />}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{p.model_pattern || '—'}</TableCell>
                  <TableCell className="text-xs">{p.model_name || '—'}</TableCell>
                  <TableCell className="text-xs">{p.engine_cc || '—'}</TableCell>
                  <TableCell className="text-xs">{toMasked((p as any).default_purchase_price) || '—'}</TableCell>
                  <TableCell className="text-xs">{toMasked((p as any).default_sale_price) || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length} padrão(ões) cadastrado(s). O WMI/VDS pode conter de 3 até 17 caracteres do chassi para identificação. O "Padrão" é o código adicional do modelo.
        </p>
    </>
  );

  const dialog = (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Padrão' : 'Novo Padrão de Chassi'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Código WMI/VDS *</Label>
                <Input value={form.wmi_code} onChange={e => setForm({ ...form, wmi_code: e.target.value.toUpperCase() })} maxLength={17} placeholder="Ex: 9C2JC" className="h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo *</Label>
                <Select value={form.vehicle_type} onValueChange={v => setForm({ ...form, vehicle_type: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moto">Moto</SelectItem>
                    <SelectItem value="carro">Carro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Marca *</Label>
                <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value.toUpperCase() })} placeholder="EX: HONDA" className="h-9 uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Padrão do Modelo</Label>
                <Input value={form.model_pattern} onChange={e => setForm({ ...form, model_pattern: e.target.value.toUpperCase() })} placeholder="Ex: KC08" className="h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do Modelo</Label>
                <Input value={form.model_name} onChange={e => setForm({ ...form, model_name: e.target.value.toUpperCase() })} placeholder="EX: CG 160 TITAN" className="h-9 uppercase" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cilindrada (CC)</Label>
                <Input type="number" value={form.engine_cc} onChange={e => setForm({ ...form, engine_cc: e.target.value })} placeholder="Ex: 162" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Combustível</Label>
                <Select value={form.fuel_type} onValueChange={v => setForm({ ...form, fuel_type: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flex">Flex</SelectItem>
                    <SelectItem value="Gasolina">Gasolina</SelectItem>
                    <SelectItem value="Etanol">Etanol</SelectItem>
                    <SelectItem value="Diesel">Diesel</SelectItem>
                    <SelectItem value="Elétrico">Elétrico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Câmbio</Label>
                <Select value={form.transmission || 'none'} onValueChange={v => setForm({ ...form, transmission: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="Automatico">Automático</SelectItem>
                    <SelectItem value="Automatizado">Automatizado</SelectItem>
                    <SelectItem value="CVT">CVT</SelectItem>
                    <SelectItem value="Semi-automatico">Semi-automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Garantia (meses)</Label>
                <Input type="number" value={form.warranty_months} onChange={e => setForm({ ...form, warranty_months: e.target.value })} placeholder="Ex: 12" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Revisão a cada (meses)</Label>
                <Input type="number" value={form.service_interval_months} onChange={e => setForm({ ...form, service_interval_months: e.target.value })} placeholder="Ex: 6" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Revisão a cada (km)</Label>
                <Input type="number" value={form.service_interval_km} onChange={e => setForm({ ...form, service_interval_km: e.target.value })} placeholder="Ex: 5000" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor de compra padrão</Label>
                <Input
                  value={form.default_purchase_price}
                  onChange={e => setForm({ ...form, default_purchase_price: maskCurrency(e.target.value) })}
                  placeholder="R$ 0,00"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor de venda padrão</Label>
                <Input
                  value={form.default_sale_price}
                  onChange={e => setForm({ ...form, default_sale_price: maskCurrency(e.target.value) })}
                  placeholder="R$ 0,00"
                  className="h-9"
                />
              </div>
              <p className="col-span-2 text-[10px] text-muted-foreground">
                Preenchem automaticamente os preços ao reconhecer o chassi no cadastro do veículo.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!form.wmi_code || !form.brand) {
                  toast({ variant: 'destructive', title: 'Preencha WMI e Marca' });
                  return;
                }
                saveMutation.mutate(form);
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        {body}
        {dialog}
      </div>
    );
  }

  return (
    <Card className="card-interactive">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Bike className="w-4 h-4 text-primary" />
              Padrões de Chassi (VIN)
            </CardTitle>
            <CardDescription className="text-sm">
              Cadastre padrões para reconhecimento automático ao registrar veículos
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5" />
            Novo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{body}</CardContent>
      {dialog}
    </Card>
  );
}
