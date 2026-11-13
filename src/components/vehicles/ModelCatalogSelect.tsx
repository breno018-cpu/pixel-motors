import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicleModels, useSaveVehicleModel, VehicleModel } from '@/hooks/useVehicleModels';
import { normalizeName, standardizeName } from '@/lib/vehicleCatalog';

interface ModelCatalogSelectProps {
  vehicleType: 'carro' | 'moto';
  brand: string;
  model: string;
  /** Trava a seleção (usado quando o chassi já identificou marca e modelo). */
  locked?: boolean;
  onChange: (value: { brand: string; model: string; catalog?: VehicleModel }) => void;
}

export function ModelCatalogSelect({ vehicleType, brand, model, locked = false, onChange }: ModelCatalogSelectProps) {
  const { data: models } = useVehicleModels();
  const { hasElevatedAccess } = useAuth();
  const saveModel = useSaveVehicleModel();
  const [addOpen, setAddOpen] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');

  const available = useMemo(
    () => (models || []).filter((m) => m.is_active && m.vehicle_type === vehicleType),
    [models, vehicleType],
  );

  const brands = useMemo(() => {
    const seen = new Map<string, string>();
    available.forEach((m) => {
      if (!seen.has(normalizeName(m.brand))) seen.set(normalizeName(m.brand), m.brand);
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [available]);

  const modelsOfBrand = useMemo(
    () => available.filter((m) => normalizeName(m.brand) === normalizeName(brand)),
    [available, brand],
  );

  // Pré-seleciona automaticamente quando só existe uma opção no catálogo.
  useEffect(() => {
    if (!brand && brands.length === 1) {
      onChange({ brand: brands[0], model: '' });
      return;
    }
    if (brand && !model && modelsOfBrand.length === 1) {
      const only = modelsOfBrand[0];
      onChange({ brand: only.brand, model: only.model, catalog: only });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, model, brands.length, modelsOfBrand.length]);

  const handleAdd = async () => {
    const b = standardizeName(newBrand);
    const m = standardizeName(newModel);
    if (!b || !m) return;
    const created = await saveModel.mutateAsync({
      data: { brand: b, model: m, vehicle_type: vehicleType, is_active: true },
    });
    setAddOpen(false);
    setNewBrand('');
    setNewModel('');
    onChange({ brand: created.brand, model: created.model, catalog: created });
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Marca *</Label>
          <Select
            value={brands.find((b) => normalizeName(b) === normalizeName(brand)) || ''}
            onValueChange={(value) => onChange({ brand: value, model: '' })}
            disabled={locked}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecionar marca" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {brands.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum modelo no catálogo</div>
              )}
              {brands.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Modelo *</Label>
            {hasElevatedAccess && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs gap-1"
                onClick={() => {
                  setNewBrand(brand || '');
                  setAddOpen(true);
                }}
              >
                <Plus className="w-3 h-3" /> Novo
              </Button>
            )}
          </div>
          <Select
            value={modelsOfBrand.find((m) => normalizeName(m.model) === normalizeName(model))?.id || ''}
            onValueChange={(id) => {
              const found = modelsOfBrand.find((m) => m.id === id);
              if (found) onChange({ brand: found.brand, model: found.model, catalog: found });
            }}
            disabled={locked || !brand}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={brand ? 'Selecionar modelo' : 'Selecione a marca'} />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {modelsOfBrand.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.model}{m.engine_cc ? (m.fuel_type?.toLowerCase().includes('elétr') || m.fuel_type?.toLowerCase().includes('eletr') ? ` · ${m.engine_cc}W` : ` · ${m.engine_cc}cc`) : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo modelo no catálogo</DialogTitle>
            <DialogDescription>
              O nome é padronizado automaticamente para manter o estoque consistente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Marca</Label>
              <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value.toUpperCase())} className="h-9 uppercase" placeholder="EX: HONDA" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Modelo</Label>
              <Input value={newModel} onChange={(e) => setNewModel(e.target.value.toUpperCase())} className="h-9 uppercase" placeholder="EX: CG 160 TITAN" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={handleAdd} disabled={saveModel.isPending || !newBrand.trim() || !newModel.trim()}>
                {saveModel.isPending ? 'Salvando...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
