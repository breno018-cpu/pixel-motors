import { User, Phone, Mail, Store, Percent, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ResellerData {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  store_id: string | null;
  commission_rate: number | null;
  is_active: boolean;
  created_at: string;
}

interface ResellerDetailsDialogProps {
  reseller: ResellerData | null;
  storeName?: string;
  contractCount?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export function ResellerDetailsDialog({ 
  reseller, 
  storeName, 
  contractCount = 0, 
  open, 
  onOpenChange 
}: ResellerDetailsDialogProps) {
  if (!reseller) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <User className="w-5 h-5 text-primary" />
            Detalhes do Revendedor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground">{reseller.full_name}</h3>
              <p className="text-muted-foreground text-sm font-mono">{reseller.cpf || 'CPF não informado'}</p>
            </div>
            <Badge variant={reseller.is_active ? 'default' : 'secondary'}>
              {reseller.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/5 p-4 rounded-lg text-center">
              <Percent className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{reseller.commission_rate || 0}%</p>
              <p className="text-sm text-muted-foreground">Comissão</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <FileText className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{contractCount}</p>
              <p className="text-sm text-muted-foreground">Contratos</p>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Contato</h4>
            <div className="space-y-2 text-sm">
              {reseller.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{reseller.phone}</span>
                </div>
              )}
              {reseller.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{reseller.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-muted-foreground" />
                <span>{storeName || 'Sem loja vinculada'}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-muted-foreground text-center pt-2">
            Cadastrado em {formatDate(reseller.created_at)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
