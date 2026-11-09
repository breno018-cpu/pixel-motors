import { Store, MapPin, Phone, Mail, User, Car, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface StoreData {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  manager_id: string | null;
  created_at: string;
}

interface StoreDetailsDialogProps {
  store: StoreData | null;
  vehicleCount?: number;
  resellerCount?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export function StoreDetailsDialog({ 
  store, 
  vehicleCount = 0, 
  resellerCount = 0, 
  open, 
  onOpenChange 
}: StoreDetailsDialogProps) {
  if (!store) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Store className="w-5 h-5 text-primary" />
            Detalhes da Loja
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground">{store.name}</h3>
              <p className="text-muted-foreground text-sm">Desde {formatDate(store.created_at)}</p>
            </div>
            <Badge variant={store.is_active ? 'default' : 'secondary'}>
              {store.is_active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/5 p-4 rounded-lg text-center">
              <Car className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{vehicleCount}</p>
              <p className="text-sm text-muted-foreground">Veículos</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{resellerCount}</p>
              <p className="text-sm text-muted-foreground">Revendedores</p>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Contato</h4>
            <div className="space-y-2 text-sm">
              {(store.address || store.city || store.state) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span>
                    {[store.address, store.city, store.state].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {store.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{store.phone}</span>
                </div>
              )}
              {store.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{store.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
