import { useMemo, useState } from 'react';
import { Check, Palette, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
  useVehicleColors,
  useSaveVehicleColor,
  useDeleteVehicleColor,
  VehicleColor,
  type ColorModelScope,
} from '@/hooks/useVehicleColors';
import { useVehicleModels } from '@/hooks/useVehicleModels';
import { normalizeName, standardizeName, STANDARD_COLORS } from '@/lib/vehicleCatalog';



const empty = {
  name: '',
  hex: '',
  hex_secondary: '',
  bicolor: false,
  model_scope: 'todos' as ColorModelScope,
  vehicle_model_ids: [] as string[],
  is_active: true,
};
type FormState = typeof empty;

/** Amostra da cor: sólida ou dividida em duas quando a cor é bicolor. */
function ColorSwatch({ hex, hexSecondary }: { hex: string | null; hexSecondary: string | null }) {
  if (!hex && !hexSecondary) {
    return (
      <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center shrink-0">
        <Palette className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg border border-border overflow-hidden flex shrink-0">
      <div className="flex-1" style={{ backgroundColor: hex || hexSecondary || undefined }} />
      {hexSecondary && <div className="flex-1" style={{ backgroundColor: hexSecondary }} />}
    </div>
  );
}

export function ColorCatalogManager() {
  const { data: colors, isLoading } = useVehicleColors();
  const { data: models } = useVehicleModels();
  const saveColor = useSaveVehicleColor();
  const deleteColor = useDeleteVehicleColor();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleColor | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const [modelSearch, setModelSearch] = useState('');

  const visibleModels = useMemo(() => {
    const q = normalizeName(modelSearch);
    return (models || []).filter(
      (m) => !q || normalizeName(`${m.brand} ${m.model}`).includes(q),
    );
  }, [models, modelSearch]);

  const toggleModel = (id: string) =>
    setForm((prev) => ({
      ...prev,
      vehicle_model_ids: prev.vehicle_model_ids.includes(id)
        ? prev.vehicle_model_ids.filter((x) => x !== id)
        : [...prev.vehicle_model_ids, id],
    }));

  const toggleAllVisible = (ids: string[]) =>
    setForm((prev) => ({
      ...prev,
      vehicle_model_ids: ids.every((id) => prev.vehicle_model_ids.includes(id))
        ? prev.vehicle_model_ids.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev.vehicle_model_ids, ...ids])),
    }));

  const modelLabel = (id: string | null) => {
    const m = (models || []).find((x) => x.id === id);
    return m ? `${m.brand} ${m.model}` : null;
  };

  /** Texto amigável da abrangência da cor na lista. */
  const scopeLabel = (c: VehicleColor) => {
    const ids = c.vehicle_model_ids?.length ? c.vehicle_model_ids : c.vehicle_model_id ? [c.vehicle_model_id] : [];
    const scope = c.model_scope || (c.vehicle_model_id ? 'apenas' : 'todos');
    if (scope === 'todos' || ids.length === 0) return 'Disponível para todos os modelos';
    const names = ids.map((id) => modelLabel(id)).filter(Boolean) as string[];
    const shown = names.slice(0, 3).join(', ');
    const rest = names.length > 3 ? ` +${names.length - 3}` : '';
    return scope === 'apenas' ? `Apenas: ${shown}${rest}` : `Todos, exceto: ${shown}${rest}`;
  };

  const filtered = useMemo(() => {
    const q = normalizeName(search);
    return (colors || []).filter((c) => !q || normalizeName(c.name).includes(q));
  }, [colors, search]);

  const startNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const startEdit = (c: VehicleColor) => {
    setEditing(c);
    setForm({
      name: c.name,
      hex: c.hex || '',
      hex_secondary: c.hex_secondary || '',
      bicolor: !!c.hex_secondary,
      model_scope: (c.model_scope || (c.vehicle_model_id ? 'apenas' : 'todos')) as ColorModelScope,
      vehicle_model_ids:
        c.vehicle_model_ids?.length ? c.vehicle_model_ids : c.vehicle_model_id ? [c.vehicle_model_id] : [],
      is_active: c.is_active,
    });
    setOpen(true);
  };

  const submit = async () => {
    await saveColor.mutateAsync({
      id: editing?.id,
      data: {
        name: standardizeName(form.name),
        hex: form.hex || null,
        hex_secondary: form.bicolor ? form.hex_secondary || null : null,
        vehicle_model_id: null,
        model_scope: form.model_scope,
        vehicle_model_ids: form.model_scope === 'todos' ? [] : form.vehicle_model_ids,
        is_active: form.is_active,
      },
    });
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cor..."
            className="pl-9 h-9"
          />
        </div>
        <Button size="sm" onClick={startNew} className="gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> Nova cor
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Cores padrão do sistema ({STANDARD_COLORS.length}) já estão disponíveis. Aqui você cadastra
        cores específicas — gerais ou vinculadas a um modelo.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma cor personalizada cadastrada.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3">
              <ColorSwatch hex={c.hex} hexSecondary={c.hex_secondary} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {scopeLabel(c)}
                </p>
              </div>
              {c.hex_secondary && (
                <Badge variant="outline" className="text-[10px]">Bicolor</Badge>
              )}
              {!c.is_active && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(c)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => deleteColor.mutate(c.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90dvh] max-w-md flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cor' : 'Nova cor'}</DialogTitle>
            <DialogDescription>
              Nomes são salvos em CAIXA ALTA para manter o mapeamento de estoque consistente.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome da cor *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                placeholder="EX: VERMELHO PEROLIZADO"
                className="h-9 uppercase"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Cor bicolor</p>
                <p className="text-xs text-muted-foreground">
                  Use duas cores quando o modelo tem combinação (ex.: PRETO / VERMELHO).
                </p>
              </div>
              <Switch
                checked={form.bicolor}
                onCheckedChange={(v) =>
                  setForm({ ...form, bicolor: v, hex_secondary: v ? form.hex_secondary || '#FFFFFF' : '' })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Amostra (opcional)</Label>
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">{form.bicolor ? 'Cor 1' : 'Cor'}</p>
                  <Input
                    type="color"
                    value={form.hex || '#000000'}
                    onChange={(e) => setForm({ ...form, hex: e.target.value })}
                    className="h-9 w-24 p-1"
                  />
                </div>
                {form.bicolor && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Cor 2</p>
                    <Input
                      type="color"
                      value={form.hex_secondary || '#FFFFFF'}
                      onChange={(e) => setForm({ ...form, hex_secondary: e.target.value })}
                      className="h-9 w-24 p-1"
                    />
                  </div>
                )}
                <ColorSwatch
                  hex={form.hex || null}
                  hexSecondary={form.bicolor ? form.hex_secondary || null : null}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Modelos que usam esta cor</Label>
              <Select
                value={form.model_scope}
                onValueChange={(v) => setForm({ ...form, model_scope: v as ColorModelScope })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="todos">Todos os modelos</SelectItem>
                  <SelectItem value="apenas">Apenas os modelos que eu escolher</SelectItem>
                  <SelectItem value="exceto">Todos os modelos, exceto os que eu escolher</SelectItem>
                </SelectContent>
              </Select>

              {form.model_scope !== 'todos' && (
                <div className="space-y-2 rounded-lg border border-border p-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Buscar modelo..."
                        className="h-8 pl-8 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      onClick={() => toggleAllVisible(visibleModels.map((m) => m.id))}
                    >
                      {visibleModels.every((m) => form.vehicle_model_ids.includes(m.id)) &&
                      visibleModels.length > 0
                        ? 'Limpar'
                        : 'Marcar todos'}
                    </Button>
                  </div>

                  <div className="max-h-52 space-y-1 overflow-auto">
                    {visibleModels.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">Nenhum modelo encontrado.</p>
                    ) : (
                      visibleModels.map((m) => {
                        const checked = form.vehicle_model_ids.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleModel(m.id)}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                              checked ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                            <span className="truncate">
                              {m.brand} {m.model}
                              <span className="ml-1 text-xs text-muted-foreground">
                                {m.vehicle_type === 'moto' ? 'Moto' : 'Carro'}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    {form.vehicle_model_ids.length} selecionado(s) ·{' '}
                    {form.model_scope === 'apenas'
                      ? 'a cor aparece só nesses modelos'
                      : 'a cor aparece em todos, menos nesses (exceções)'}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Cor ativa</p>
                <p className="text-xs text-muted-foreground">Cores inativas não aparecem no cadastro.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saveColor.isPending || !form.name.trim()}>
              {saveColor.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
