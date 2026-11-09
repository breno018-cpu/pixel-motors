import { Car, Bike, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useVehicles } from '@/hooks/useVehicles';
import { cn } from '@/lib/utils';

interface Reseller {
  id: string;
  full_name: string;
}

interface ResellerStockDialogProps {
  reseller: Reseller | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  disponivel: { label: 'Disponível', class: 'bg-success/10 text-success border-success/20' },
  reservado: { label: 'Reservado', class: 'bg-warning/10 text-warning border-warning/20' },
};

function formatCurrency(value: number | null) {
  if (!value) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ResellerStockDialog({ reseller, open, onOpenChange }: ResellerStockDialogProps) {
  const { data: vehicles, isLoading } = useVehicles();

  // Veículos vinculados ao revendedor
  const resellerVehicles = vehicles?.filter(v => 
    v.reseller_id === reseller?.id && v.status !== 'vendido'
  ) || [];

  if (!reseller) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Package className="w-5 h-5 text-primary" />
            Estoque de {reseller.full_name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : resellerVehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum veículo no estoque</h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Este revendedor ainda não possui veículos vinculados.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              {resellerVehicles.length} veículo(s) no estoque
            </p>
            {resellerVehicles.map((vehicle) => (
              <Card key={vehicle.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {vehicle.vehicle_type === 'moto' ? (
                        <Bike className="w-5 h-5 text-primary" />
                      ) : (
                        <Car className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-foreground">
                          {vehicle.brand} {vehicle.model}
                        </h4>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", statusConfig[vehicle.status as keyof typeof statusConfig]?.class)}
                        >
                          {statusConfig[vehicle.status as keyof typeof statusConfig]?.label || vehicle.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{vehicle.year}</span>
                        {vehicle.color && <span>• {vehicle.color}</span>}
                        {vehicle.chassis && (
                          <span className="font-mono text-xs">• {vehicle.chassis}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(vehicle.sale_price)}
                      </span>
                      {vehicle.plate && (
                        <p className="text-xs bg-muted px-2 py-0.5 rounded font-mono mt-1 inline-block">
                          {vehicle.plate}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
