import { useMemo, useState } from 'react';
import { Bike, Car, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useVehicleModels,
  useSaveVehicleModel,
  useDeleteVehicleModel,
  VehicleModel,
} from '@/hooks/useVehicleModels';
import { normalizeName, standardizeName } from '@/lib/vehicleCatalog';
import { maskCurrency, parseCurrency } from '@/lib/masks';

const empty = {
  brand: '',
  model: '',
  vehicle_type: 'moto' as 'moto' | 'carro',
  engine_cc: '',
  fuel_type: '',
  transmission: '',
  warranty_months: '',
  revision_period_months: '',
  revision_period_km: '',
  default_purchase_price: '',
  default_sale_price: '',
  is_active: true,
};

type FormState = typeof empty;

function toForm(m: VehicleModel): FormState {
  return {
    brand: m.brand,
    model: m.model,
    vehicle_type: m.vehicle_type,
    engine_cc: m.engine_cc?.toString() || '',
    fuel_type: m.fuel_type || '',
    transmission: m.transmission || '',
    warranty_months: m.warranty_months?.toString() || '',
    revision_period_months: m.revision_period_months?.toString() || '',
    revision_period_km: m.revision_period_km?.toString() || '',
    default_purchase_price: m.default_purchase_price != null ? maskCurrency(String(Math.round(m.default_purchase_price * 100))) : '',
    default_sale_price: m.default_sale_price != null ? maskCurrency(String(Math.round(m.default_sale_price * 100))) : '',
    is_active: m.is_active,
  };
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));

export function VehicleModelManager({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: models, isLoading } = useVehicleModels();
  const saveModel = useSaveVehicleModel();
  const deleteModel = useDeleteVehicleModel();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleModel | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const filtered = useMemo(() => {
    const q = normalizeName(search);
    return (models || []).filter(
      (m) => !q || normalizeName(`${m.brand} ${m.model}`).includes(q),
    );
  }, [models, search]);

  const startNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const startEdit = (m: VehicleModel) => {
    setEditing(m);
    setForm(toForm(m));
    setOpen(true);
  };

  const submit = async () => {
    await saveModel.mutateAsync({
      id: editing?.id,
      data: {
        brand: standardizeName(form.brand),
        model: standardizeName(form.model),
        vehicle_type: form.vehicle_type,
        engine_cc: num(form.engine_cc),
        fuel_type: form.fuel_type || null,
        transmission: form.transmission || null,
        warranty_months: num(form.warranty_months),
        revision_period_months: num(form.revision_period_months),
        revision_period_km: num(form.revision_period_km),
        default_purchase_price: form.default_purchase_price ? parseCurrency(form.default_purchase_price) : null,
        default_sale_price: form.default_sale_price ? parseCurrency(form.default_sale_price) : null,
        is_active: form.is_active,
      },
    });
    setOpen(false);
  };

  const body = (
    <>
      {embedded && (
        <div className="flex justify-end">
          <Button size="sm" onClick={startNew} className="gap-1.5 shrink-0">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      )}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar modelo..."
            className="pl-9 h-9"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum modelo cadastrado.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {filtered.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {m.vehicle_type === 'moto' ? (
                    <Bike className="w-4 h-4 text-primary" />
                  ) : (
                    <Car className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {m.brand} {m.model}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[
                      m.engine_cc ? `${m.engine_cc}cc` : null,
                      m.fuel_type,
                      m.transmission,
                      m.warranty_months ? `Garantia ${m.warranty_months}m` : null,
                      m.default_sale_price ? `Venda ${maskCurrency(String(Math.round(m.default_sale_price * 100)))}` : null,
                    ].filter(Boolean).join(' · ') || 'Sem padrões definidos'}
                  </p>
                </div>
                {!m.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(m)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteModel.mutate(m.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
    </>
  );

  const dialog = (

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
            <DialogDescription>
              Estes padrões são aplicados automaticamente ao cadastrar um veículo deste modelo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Marca *</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value.toUpperCase() })} className="h-9 uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Modelo *</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value.toUpperCase() })} className="h-9 uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo</Label>
              <Select
                value={form.vehicle_type}
                onValueChange={(v) => setForm({ ...form, vehicle_type: v as 'moto' | 'carro' })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="carro">Carro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cilindrada (cc)</Label>
              <Input type="number" value={form.engine_cc} onChange={(e) => setForm({ ...form, engine_cc: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Combustível</Label>
              <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="gasolina">Gasolina</SelectItem>
                  <SelectItem value="etanol">Etanol</SelectItem>
                  <SelectItem value="flex">Flex</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="eletrico">Elétrico</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Câmbio</Label>
              <Select value={form.transmission} onValueChange={(v) => setForm({ ...form, transmission: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatico">Automático</SelectItem>
                  <SelectItem value="cvt">CVT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Garantia (meses)</Label>
              <Input type="number" value={form.warranty_months} onChange={(e) => setForm({ ...form, warranty_months: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Revisão (meses)</Label>
              <Input type="number" value={form.revision_period_months} onChange={(e) => setForm({ ...form, revision_period_months: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Revisão (km)</Label>
              <Input type="number" value={form.revision_period_km} onChange={(e) => setForm({ ...form, revision_period_km: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Valor de compra padrão</Label>
              <Input
                value={form.default_purchase_price}
                onChange={(e) => setForm({ ...form, default_purchase_price: maskCurrency(e.target.value) })}
                placeholder="R$ 0,00"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Valor de venda padrão</Label>
              <Input
                value={form.default_sale_price}
                onChange={(e) => setForm({ ...form, default_sale_price: maskCurrency(e.target.value) })}
                placeholder="R$ 0,00"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">Preenche o preço automaticamente no cadastro.</p>
            </div>
            <div className="flex items-center justify-between col-span-2 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Modelo ativo</p>
                <p className="text-xs text-muted-foreground">Modelos inativos não aparecem no cadastro.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saveModel.isPending || !form.brand.trim() || !form.model.trim()}>
              {saveModel.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Catálogo de Modelos</CardTitle>
          <CardDescription>
            Nomes oficiais usados no cadastro de veículos. Padroniza o mapeamento de estoque e relatórios.
          </CardDescription>
        </div>
        <Button size="sm" onClick={startNew} className="gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">{body}</CardContent>
      {dialog}
    </Card>
  );
}
