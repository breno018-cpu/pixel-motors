import { Car, Bike, Calendar, Gauge, Palette, Fuel, Settings2, Store, Hash, FileText, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { isElectricVehicle } from '@/lib/vehicleCatalog';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
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
  reseller_id?: string | null;
  vehicle_type?: 'carro' | 'moto' | null;
  engine_cc?: number | null;
  created_at: string;
}

interface VehicleDetailsDialogProps {
  vehicle: Vehicle | null;
  storeName?: string;
  resellerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; class: string }> = {
  disponivel: { label: 'Disponível', class: 'bg-success/10 text-success border-success/20' },
  reservado: { label: 'Reservado', class: 'bg-warning/10 text-warning border-warning/20' },
  vendido: { label: 'Vendido', class: 'bg-muted text-muted-foreground border-muted' },
};

function formatCurrency(value: number | null) {
  if (!value) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VehicleDetailsDialog({ vehicle, storeName, resellerName, open, onOpenChange }: VehicleDetailsDialogProps) {
  if (!vehicle) return null;

  const isMoto = vehicle.vehicle_type === 'moto';
  const isElectric = isElectricVehicle(vehicle);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            {isMoto ? (
              <Bike className="w-5 h-5 text-primary" />
            ) : (
              <Car className="w-5 h-5 text-primary" />
            )}
            Detalhes do Veículo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                {vehicle.brand} {vehicle.model}
              </h3>
              <p className="text-muted-foreground text-sm">Ano {vehicle.year}</p>
            </div>
            <Badge variant="outline" className={cn("text-sm", statusConfig[vehicle.status]?.class)}>
              {statusConfig[vehicle.status]?.label || vehicle.status}
            </Badge>
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Cor</p>
                <p className="font-medium">{vehicle.color || 'Não informada'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">{isElectric ? 'Potência' : (isMoto ? 'Cilindrada' : 'Quilometragem')}</p>
                <p className="font-medium">
                  {isElectric
                    ? `${vehicle.engine_cc && vehicle.engine_cc > 0 ? `${vehicle.engine_cc} W` : '100% Elétrica'}`
                    : (isMoto 
                        ? `${vehicle.engine_cc || 0} cc`
                        : `${vehicle.mileage?.toLocaleString() || 0} km`
                      )
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Propulsão / Combustível</p>
                <p className="font-medium capitalize">{isElectric ? '⚡ 100% Elétrica' : (vehicle.fuel_type || 'Não informado')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Transmissão</p>
                <p className="font-medium capitalize">{isElectric ? 'Direta (Sem Câmbio)' : (vehicle.transmission || 'Não informado')}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Identification */}
          <div className="space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <Hash className="w-4 h-4" /> Identificação
            </h4>
            <div className="grid grid-cols-1 gap-2 text-sm bg-muted/50 p-3 rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Placa</span>
                <span className="font-mono font-medium">{vehicle.plate || 'Não informada'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isElectricVehicle(vehicle) ? 'Número da Moto / Motor' : 'Chassi'}</span>
                <span className="font-mono text-xs">{vehicle.chassis || 'Não informado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Renavam</span>
                <span className="font-mono">{vehicle.renavam || 'Não informado'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/5 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Preço de Venda</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(vehicle.sale_price)}</p>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <Store className="w-3.5 h-3.5" /> Loja
              </p>
              <p className="font-medium">{storeName || 'Não atribuída'}</p>
            </div>
          </div>

          {resellerName && (
            <div className="bg-warning/10 p-3 rounded-lg border border-warning/20">
              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Sob responsabilidade de
              </p>
              <p className="font-medium text-warning">{resellerName}</p>
            </div>
          )}

          {/* Notes */}
          {vehicle.notes && (
            <div className="space-y-2">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" /> Observações
              </h4>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                {vehicle.notes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="text-xs text-muted-foreground text-center pt-2">
            Cadastrado em {formatDate(vehicle.created_at)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
