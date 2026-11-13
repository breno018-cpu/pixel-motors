import { useMemo, useState } from 'react';
import { Bike, Car, Flame, Search, Tag } from 'lucide-react';
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
import { useVehicleModels, useSaveVehicleModel, effectiveModelPrice, VehicleModel } from '@/hooks/useVehicleModels';
import { normalizeName } from '@/lib/vehicleCatalog';
import { maskCurrency, parseCurrency } from '@/lib/masks';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const brl = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const toMask = (v: number | null) => (v != null ? maskCurrency(String(Math.round(v * 100))) : '');

interface PriceForm {
  default_sale_price: string;
  promo_price: string;
  promo_active: boolean;
  promo_label: string;
  promo_ends_on: string;
}

/** Tabela de preços dos modelos com vitrine de promoções. */
export function ModelPriceTable() {
  const { data: models, isLoading } = useVehicleModels();
  const saveModel = useSaveVehicleModel();
  const { hasElevatedAccess } = useAuth();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<VehicleModel | null>(null);
  const [form, setForm] = useState<PriceForm>({
    default_sale_price: '',
    promo_price: '',
    promo_active: false,
    promo_label: '',
    promo_ends_on: '',
  });

  const list = useMemo(() => {
    const q = normalizeName(search);
    return (models || [])
      .filter((m) => m.is_active)
      .filter((m) => !q || normalizeName(`${m.brand} ${m.model}`).includes(q))
      .sort((a, b) => {
        const pa = effectiveModelPrice(a).isPromo ? 0 : 1;
        const pb = effectiveModelPrice(b).isPromo ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'pt-BR');
      });
  }, [models, search]);

  const promoCount = list.filter((m) => effectiveModelPrice(m).isPromo).length;
  const missingPrice = list.filter((m) => !m.default_sale_price).length;

  const openEdit = (m: VehicleModel) => {
    setEditing(m);
    setForm({
      default_sale_price: toMask(m.default_sale_price),
      promo_price: toMask(m.promo_price),
      promo_active: m.promo_active,
      promo_label: m.promo_label || '',
      promo_ends_on: m.promo_ends_on || '',
    });
  };

  const submit = async () => {
    if (!editing) return;
    await saveModel.mutateAsync({
      id: editing.id,
      data: {
        default_sale_price: form.default_sale_price ? parseCurrency(form.default_sale_price) : null,
        promo_price: form.promo_price ? parseCurrency(form.promo_price) : null,
        promo_active: form.promo_active && !!form.promo_price,
        promo_label: form.promo_label ? form.promo_label.toUpperCase().trim() : null,
        promo_ends_on: form.promo_ends_on || null,
      },
    });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar modelo..."
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <Badge variant="outline" className="h-10 rounded-xl px-3 text-xs font-semibold">
          {list.length} modelos
        </Badge>
        <Badge className="h-10 rounded-xl px-3 text-xs font-semibold bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
          <Flame className="mr-1.5 h-3.5 w-3.5" /> {promoCount} em promoção
        </Badge>
      </div>

      {missingPrice > 0 && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
          {missingPrice} modelo(s) sem preço de tabela. Sem preço, o cadastro de veículo fica sem valor padrão.
        </p>
      )}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum modelo ativo no catálogo.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => {
            const { price, isPromo } = effectiveModelPrice(m);
            return (
              <div
                key={m.id}
                className={cn(
                  'relative overflow-hidden rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md',
                  isPromo ? 'border-primary/40 shadow-sm' : 'border-border/70',
                )}
              >
                {isPromo && (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    <Flame className="h-3 w-3" />
                    {m.promo_label || 'Promoção'}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    {m.vehicle_type === 'moto' ? <Bike className="h-4 w-4" /> : <Car className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {m.brand}
                    </p>
                    <p className="truncate font-display text-base font-semibold">{m.model}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-end gap-2">
                  <span className="font-display text-2xl font-bold tracking-tight">{brl(price)}</span>
                  {isPromo && m.default_sale_price != null && (
                    <span className="pb-1 text-sm text-muted-foreground line-through">
                      {brl(m.default_sale_price)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    m.engine_cc
                      ? (m.fuel_type?.toLowerCase().includes('elet') || m.model.toLowerCase().includes('elét') || m.model.toLowerCase().includes('elet')
                          ? `${m.engine_cc}W`
                          : `${m.engine_cc}cc`)
                      : null,
                    m.fuel_type?.toLowerCase().includes('elet') ? null : m.transmission,
                    isPromo && m.promo_ends_on
                      ? `Até ${new Date(`${m.promo_ends_on}T12:00:00`).toLocaleDateString('pt-BR')}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Preço de tabela'}
                </p>

                {hasElevatedAccess && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 h-9 w-full rounded-xl gap-1.5"
                    onClick={() => openEdit(m)}
                  >
                    <Tag className="h-3.5 w-3.5" /> Definir preço e promoção
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing?.brand} {editing?.model}
            </DialogTitle>
            <DialogDescription>
              O preço de tabela é aplicado automaticamente a todas as unidades deste modelo. O vendedor ainda
              pode ajustar o valor de cada moto na hora da venda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Preço de tabela *</Label>
              <Input
                value={form.default_sale_price}
                onChange={(e) => setForm({ ...form, default_sale_price: maskCurrency(e.target.value) })}
                placeholder="R$ 0,00"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Promoção ativa</p>
                <p className="text-xs text-muted-foreground">Aparece em destaque na vitrine de preços.</p>
              </div>
              <Switch
                checked={form.promo_active}
                onCheckedChange={(v) => setForm({ ...form, promo_active: v })}
              />
            </div>
            {form.promo_active && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Preço promocional</Label>
                  <Input
                    value={form.promo_price}
                    onChange={(e) => setForm({ ...form, promo_price: maskCurrency(e.target.value) })}
                    placeholder="R$ 0,00"
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Vale até</Label>
                  <Input
                    type="date"
                    value={form.promo_ends_on}
                    onChange={(e) => setForm({ ...form, promo_ends_on: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-sm">Etiqueta</Label>
                  <Input
                    value={form.promo_label}
                    onChange={(e) => setForm({ ...form, promo_label: e.target.value.toUpperCase() })}
                    placeholder="EX: FEIRÃO DE SETEMBRO"
                    className="h-10 rounded-xl uppercase"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saveModel.isPending}>
              {saveModel.isPending ? 'Salvando...' : 'Salvar preço'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
